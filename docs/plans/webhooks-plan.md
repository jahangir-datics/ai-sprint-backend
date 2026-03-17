# Implementation Plan: Feature 2 — Webhook System

**Spec**: `docs/specs/webhooks-spec.md`
**Branch**: `feat/webhooks`
**Base**: `main`

---

## Summary

Implement a full webhook system: CRUD management, async event processing with a database-backed queue, HMAC-SHA256 signed HTTP deliveries, exponential backoff retries, and delivery logging. All endpoints use the existing `CombinedAuthGuard` (JWT or API key) and owner-scoped access.

---

## Scope Decisions

The spec is comprehensive. For the sprint, we implement the **core system** that passes all acceptance criteria:

| Include | Defer |
|---------|-------|
| Full webhook CRUD (create, list, get, update, delete) | `/webhooks/:id/rotate-secret` (nice-to-have) |
| Activate/deactivate endpoints | Per-webhook custom retry policy |
| Event types catalog API | SSRF DNS-level resolution checks |
| Event emission + database-backed queue processor | `/webhook-deliveries` cross-webhook query |
| HMAC-SHA256 signed delivery via HTTP POST | |
| Exponential backoff retries (5 attempts) | |
| Full delivery logging | |
| Test delivery endpoint | |
| Event + delivery log query APIs | |
| SSRF protection (URL pattern validation) | |
| Manual retry of failed events | |

**Total endpoints: 13** (vs spec's 15 — deferring rotate-secret and cross-webhook delivery listing)

---

## Step-by-Step Implementation

### Step 1: Update Prisma Schema

**Files**: `prisma/schema.prisma`

The existing schema has a simplified Webhook/WebhookDelivery model. Update to match the spec's 3-model design:

- **Webhook**: Add `name`, `description`, rename `events` → `subscribedEvents`
- **WebhookEvent**: New model — queued event instance with status tracking
- **WebhookDelivery**: Restructure — links to WebhookEvent (not Webhook directly), add `attemptNumber`, `durationMs`, `requestHeaders`, `requestBody`
- **Enums**: Replace `DeliveryStatus` with `WebhookEventStatus` + `WebhookDeliveryStatus`

Run: `npx prisma migrate dev --name add-webhook-event-model`

### Step 2: Define Event Types Constant

**Files**: `src/webhooks/webhook-event-types.ts`

```ts
export const WEBHOOK_EVENT_TYPES = [
  'user.created', 'user.updated',
  'api_key.created', 'api_key.revoked',
  'feature_flag.created', 'feature_flag.updated', 'feature_flag.deleted',
  'webhook.created', 'webhook.updated', 'webhook.deleted',
] as const;
export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number];

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = { ... };
```

### Step 3: Create DTOs

**Files**: `src/webhooks/dto/`

- `create-webhook.dto.ts` — name (3-100 chars), url (HTTPS, @IsUrl), description (optional, max 500), subscribedEvents (non-empty array, each must be valid event type), isActive (optional boolean)
- `update-webhook.dto.ts` — PartialType of create DTO
- `list-webhooks-query.dto.ts` — page, limit, isActive, eventType
- `list-events-query.dto.ts` — page, limit, status, eventType
- `test-webhook.dto.ts` — eventType (valid event type)

**Validation**: Custom validator for subscribedEvents array items against `WEBHOOK_EVENT_TYPES`. URL validation rejects localhost/private IPs (SSRF protection).

### Step 4: WebhooksService — CRUD

**Files**: `src/webhooks/webhooks.service.ts`

Methods:
- `create(userId, dto)` — generate secret (`whsec_` + 32 random hex), store in DB, return webhook (secret shown once)
- `findAll(userId, query)` — paginated list, filter by isActive/eventType, owner-scoped
- `findOne(userId, id)` — get webhook, verify ownership, exclude secret from response
- `update(userId, id, dto)` — partial update, verify ownership
- `remove(userId, id)` — hard delete, verify ownership
- `activate(userId, id)` / `deactivate(userId, id)` — toggle isActive
- `testDelivery(userId, id, eventType)` — create a WebhookEvent with test payload

**Secret handling**: Store raw secret (needed for HMAC signing). Mask in all responses except create (show once). Format: `whsec_` + 32 hex chars.

**Ownership check**: All mutations verify `webhook.userId === userId`. Throw `NotFoundException` if not found or not owned (don't leak existence).

### Step 5: WebhookEventsService — Event Lifecycle

**Files**: `src/webhooks/webhook-events.service.ts`

Methods:
- `emit(eventType, payload)` — find all active webhooks subscribed to eventType, create WebhookEvent per webhook with status PENDING
- `findByWebhook(userId, webhookId, query)` — paginated events for a webhook, verify webhook ownership
- `findOne(userId, webhookId, eventId)` — single event, verify ownership chain
- `getDeliveries(userId, webhookId, eventId)` — delivery attempts for an event
- `retry(userId, webhookId, eventId)` — only if status is FAILED, reset to PENDING

### Step 6: WebhookDeliveryService — HTTP Dispatch & Signing

**Files**: `src/webhooks/webhook-delivery.service.ts`

Responsibilities:
- **Sign**: HMAC-SHA256 with `${timestamp}.${rawBody}`, using webhook's secret
- **Deliver**: HTTP POST to webhook URL with required headers (Content-Type, User-Agent, X-Webhook-Id, X-Webhook-Event-Id, X-Webhook-Event-Type, X-Webhook-Timestamp, X-Webhook-Signature)
- **Timeout**: 5 second AbortController timeout
- **Log**: Create WebhookDelivery record with status, responseCode, durationMs, errorMessage, requestHeaders, requestBody
- **Evaluate**: SUCCESS on 2xx, TIMEOUT on abort, FAILED otherwise

Use Node.js native `fetch` (available in Node 20+) — no extra HTTP dependency needed.

### Step 7: WebhookQueueProcessor — Database-Backed Worker

**Files**: `src/webhooks/webhook-queue.processor.ts`

Database polling approach (no Redis dependency):
- Runs on `setInterval` (every 5 seconds)
- Queries: `WebhookEvent WHERE status IN (PENDING, RETRYING) AND (nextAttemptAt IS NULL OR nextAttemptAt <= now())`
- Uses `UPDATE ... WHERE` pattern for optimistic locking (set status to PROCESSING, only proceed if update succeeds)
- Processes one event at a time per tick
- On delivery result:
  - Success → mark DELIVERED, set deliveredAt
  - Retryable failure + attempts < 5 → mark RETRYING, set nextAttemptAt per schedule
  - Final failure → mark FAILED, set lastError

**Retry delays**: `[10_000, 30_000, 120_000, 600_000, 1_800_000]` ms

**Retry logic**: Retry on network errors, timeouts, 5xx, 429. Don't retry on 4xx (except 429).

### Step 8: URL Validation (SSRF Protection)

**Files**: `src/webhooks/validators/url.validator.ts`

Custom class-validator decorator `@IsWebhookUrl()`:
- Must be valid URL with `https://` protocol
- Reject hostnames: `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`
- Reject private IP ranges: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `169.254.x.x`
- Applied on create and update DTOs

### Step 9: WebhooksController

**Files**: `src/webhooks/webhooks.controller.ts`

Endpoints:
```
POST   /webhooks                              → create
GET    /webhooks                              → findAll
GET    /webhooks/event-types                  → getEventTypes (static, before :id routes)
GET    /webhooks/:id                          → findOne
PATCH  /webhooks/:id                          → update
DELETE /webhooks/:id                          → remove
POST   /webhooks/:id/activate                 → activate
POST   /webhooks/:id/deactivate               → deactivate
POST   /webhooks/:id/test                     → testDelivery
GET    /webhooks/:id/events                   → listEvents
GET    /webhooks/:id/events/:eventId          → getEvent
GET    /webhooks/:id/events/:eventId/deliveries → getDeliveries
POST   /webhooks/:id/events/:eventId/retry    → retryEvent
```

All decorated with `@ApiTags('Webhooks')`, `@ApiBearerAuth()`, Swagger decorators. Use `@CurrentUser()` for userId.

**Important**: `event-types` route must be declared BEFORE `:id` routes to avoid NestJS treating "event-types" as an id parameter.

### Step 10: WebhooksModule

**Files**: `src/webhooks/webhooks.module.ts`

- Providers: WebhooksService, WebhookEventsService, WebhookDeliveryService, WebhookQueueProcessor
- Controllers: WebhooksController
- Imports: PrismaModule
- Exports: WebhookEventsService (for other modules to emit events)

### Step 11: Wire Up in AppModule

**Files**: `src/app.module.ts`

Add `WebhooksModule` to imports.

### Step 12: Unit Tests

**Files**:
- `src/webhooks/webhooks.service.spec.ts` — CRUD operations, ownership checks, secret generation
- `src/webhooks/webhook-events.service.spec.ts` — emit creates events for matching webhooks, retry logic
- `src/webhooks/webhook-delivery.service.spec.ts` — HMAC signing, timeout handling, status evaluation
- `src/webhooks/webhook-queue.processor.spec.ts` — event processing, retry scheduling, status transitions

### Step 13: E2E Tests

**Files**: `test/webhooks.e2e-spec.ts`

Tests:
- Create webhook → verify response shape, secret shown once
- List webhooks → paginated, filtered
- Get webhook → secret masked
- Update webhook → partial update
- Delete webhook → hard delete
- Activate/deactivate → toggle isActive
- Get event types → returns catalog
- Test delivery → creates pending event
- Owner isolation → user A can't access user B's webhooks
- Validation → reject invalid URL, empty subscribedEvents, invalid event types

### Step 14: Prisma Migration + Build Verification

- Run migration
- Verify build passes
- Verify lint passes (0 errors)
- Verify all unit tests pass
- Verify E2E tests pass

---

## File Summary

| # | File | Action |
|---|------|--------|
| 1 | `prisma/schema.prisma` | Modify — update webhook models |
| 2 | `src/webhooks/webhook-event-types.ts` | Create |
| 3 | `src/webhooks/dto/create-webhook.dto.ts` | Create |
| 4 | `src/webhooks/dto/update-webhook.dto.ts` | Create |
| 5 | `src/webhooks/dto/list-webhooks-query.dto.ts` | Create |
| 6 | `src/webhooks/dto/list-events-query.dto.ts` | Create |
| 7 | `src/webhooks/dto/test-webhook.dto.ts` | Create |
| 8 | `src/webhooks/validators/url.validator.ts` | Create |
| 9 | `src/webhooks/webhooks.service.ts` | Create |
| 10 | `src/webhooks/webhook-events.service.ts` | Create |
| 11 | `src/webhooks/webhook-delivery.service.ts` | Create |
| 12 | `src/webhooks/webhook-queue.processor.ts` | Create |
| 13 | `src/webhooks/webhooks.controller.ts` | Create |
| 14 | `src/webhooks/webhooks.module.ts` | Create |
| 15 | `src/app.module.ts` | Modify — add WebhooksModule |
| 16 | `src/webhooks/webhooks.service.spec.ts` | Create |
| 17 | `src/webhooks/webhook-events.service.spec.ts` | Create |
| 18 | `src/webhooks/webhook-delivery.service.spec.ts` | Create |
| 19 | `src/webhooks/webhook-queue.processor.spec.ts` | Create |
| 20 | `test/webhooks.e2e-spec.ts` | Create |
| 21 | `prisma/migrations/...` | Generated |

**Total: ~20 files, 13 endpoints**

---

## Dependencies

- No new npm packages needed (Node.js native `fetch` for HTTP, `node:crypto` for HMAC)
- Prisma migration required
- Existing: PrismaModule, CombinedAuthGuard (global), TransformInterceptor (global), @CurrentUser decorator

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Queue processor concurrent picks | Optimistic locking via status check in UPDATE WHERE clause |
| Long-running delivery blocks processor | 5s timeout on all HTTP requests |
| Prisma v7 schema migration issues | Test migration locally before CI |
| `event-types` route conflict with `:id` | Declare static routes before parameterized routes in controller |
