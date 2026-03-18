# Feature 2 Specification: Webhook System

## 1. Overview & Goals

The Webhook System enables the Developer Platform API to notify external systems when important events occur. It provides a secure, reliable, and auditable mechanism for sending event-driven HTTP callbacks to user-configured endpoints.

This feature should allow platform users or internal systems to:

* Register webhook endpoints that listen for specific event types
* Securely deliver event payloads to external URLs via HTTP POST
* Sign each delivery using HMAC-SHA256 so receivers can verify authenticity
* Track every delivery attempt with detailed logs
* Retry failed deliveries using exponential backoff
* Expose management APIs for webhook configuration, supported event types, and delivery history

The system must integrate cleanly with the existing platform architecture:

* Authentication via JWT or API key using `CombinedAuthGuard`
* Role-based access control through the existing roles guard
* Standard response format through the global `TransformInterceptor`, wrapping all responses as:

```json
{
  "data": {},
  "message": "Success",
  "statusCode": 200
}
```

### Goals

1. Allow authenticated users to create and manage webhook endpoints
2. Maintain a catalog of webhook event types supported by the platform
3. Process emitted events asynchronously through a queue
4. Deliver webhook payloads reliably with retries
5. Log all attempts for observability and debugging
6. Ensure delivery authenticity and endpoint safety

### Non-Goals

1. Incoming webhook ingestion from third-party systems
2. Webhook payload transformation per customer
3. Per-webhook custom retry policy in the first version
4. Guaranteed exactly-once delivery; system guarantees at-least-once delivery

---

## 2. Prisma Schema Models

The webhook system requires three core models:

* `Webhook`: configuration for a subscriber endpoint
* `WebhookEvent`: an instance of a platform event to be delivered
* `WebhookDelivery`: an individual delivery attempt for a webhook event

### Prisma Schema

```prisma
model Webhook {
  id              String          @id @default(uuid())
  userId          String
  name            String
  url             String
  secret          String
  isActive        Boolean         @default(true)
  subscribedEvents String[]       // event type keys, e.g. ["user.created", "api_key.revoked"]
  description     String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  events          WebhookEvent[]

  @@index([userId])
  @@index([isActive])
}

model WebhookEvent {
  id              String             @id @default(uuid())
  webhookId       String
  eventType       String
  payload         Json
  status          WebhookEventStatus @default(PENDING)
  nextAttemptAt   DateTime?
  deliveredAt     DateTime?
  lastError       String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  webhook         Webhook            @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  deliveries      WebhookDelivery[]

  @@index([webhookId])
  @@index([eventType])
  @@index([status])
  @@index([nextAttemptAt])
}

model WebhookDelivery {
  id              String               @id @default(uuid())
  webhookEventId  String
  attemptNumber   Int
  status          WebhookDeliveryStatus
  responseCode    Int?
  responseBody    String?
  errorMessage    String?
  durationMs      Int?
  requestHeaders  Json?
  requestBody     Json?
  attemptedAt     DateTime             @default(now())

  webhookEvent    WebhookEvent         @relation(fields: [webhookEventId], references: [id], onDelete: Cascade)

  @@unique([webhookEventId, attemptNumber])
  @@index([webhookEventId])
  @@index([status])
  @@index([attemptedAt])
}

enum WebhookEventStatus {
  PENDING
  PROCESSING
  RETRYING
  DELIVERED
  FAILED
}

enum WebhookDeliveryStatus {
  SUCCESS
  FAILED
  TIMEOUT
}
```

---

## 3. Domain Model Notes

### `Webhook`

Represents a configured destination endpoint owned by a user.

#### Important fields

* `url`: destination URL for delivery
* `secret`: HMAC signing secret, stored securely
* `subscribedEvents`: list of platform event types the webhook wants to receive
* `isActive`: disabled webhooks should not receive events

### `WebhookEvent`

Represents a queued delivery instance created when the platform emits an event for a matching webhook.

#### Important fields

* `eventType`: logical event key such as `user.created`
* `payload`: JSON payload sent to the webhook
* `status`: overall state of processing
* `nextAttemptAt`: used by the queue/retry worker
* `deliveredAt`: timestamp of successful completion
* `lastError`: latest known failure reason

### `WebhookDelivery`

Represents one delivery attempt for a specific `WebhookEvent`.

#### Important fields

* `attemptNumber`: starts at `1`
* `responseCode`: HTTP status code from target endpoint
* `durationMs`: time taken for delivery
* `errorMessage`: network, timeout, TLS, DNS, or internal error details
* `requestHeaders`: headers used for signing and metadata
* `requestBody`: payload snapshot at send time

---

## 4. Event Types

Webhook event types should be centrally defined in application code and exposed via a read-only API. Examples:

```ts
export const WEBHOOK_EVENT_TYPES = [
  'user.created',
  'user.updated',
  'api_key.created',
  'api_key.revoked',
  'feature_flag.created',
  'feature_flag.updated',
  'feature_flag.deleted',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted'
] as const;

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number];
```

These event types are not stored as a dedicated database table in the first version unless future requirements demand admin-managed event catalogs.

---

## 5. API Endpoints

## 5.1 Webhook CRUD Endpoints

### Endpoint Table

| Method | Path                          | Auth           | Description                   |
| ------ | ----------------------------- | -------------- | ----------------------------- |
| POST   | `/webhooks`                   | JWT or API Key | Create a webhook              |
| GET    | `/webhooks`                   | JWT or API Key | List current user's webhooks  |
| GET    | `/webhooks/:id`               | JWT or API Key | Get a specific webhook        |
| PATCH  | `/webhooks/:id`               | JWT or API Key | Update webhook configuration  |
| DELETE | `/webhooks/:id`               | JWT or API Key | Delete a webhook              |
| POST   | `/webhooks/:id/rotate-secret` | JWT or API Key | Rotate webhook signing secret |
| POST   | `/webhooks/:id/activate`      | JWT or API Key | Activate webhook              |
| POST   | `/webhooks/:id/deactivate`    | JWT or API Key | Deactivate webhook            |
| POST   | `/webhooks/:id/test`          | JWT or API Key | Trigger a test delivery       |

---

### Create Webhook

**POST** `/webhooks`

#### Request Body

```json
{
  "name": "My Production Webhook",
  "url": "https://example.com/webhooks/platform",
  "description": "Receives user and API key lifecycle events",
  "subscribedEvents": ["user.created", "api_key.revoked"],
  "isActive": true
}
```

#### Validation Rules

* `name`: required, string, 3-100 chars
* `url`: required, valid HTTPS URL
* `description`: optional, max 500 chars
* `subscribedEvents`: required, non-empty array of valid event type keys
* `isActive`: optional, defaults to `true`

#### Wrapped Response

```json
{
  "data": {
    "id": "uuid",
    "name": "My Production Webhook",
    "url": "https://example.com/webhooks/platform",
    "description": "Receives user and API key lifecycle events",
    "subscribedEvents": ["user.created", "api_key.revoked"],
    "isActive": true,
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z"
  },
  "message": "Webhook created successfully",
  "statusCode": 201
}
```

---

### List Webhooks

**GET** `/webhooks`

#### Query Params

* `page`: optional, default 1
* `limit`: optional, default 20
* `isActive`: optional, boolean filter
* `eventType`: optional, filter by subscribed event

---

### Update Webhook

**PATCH** `/webhooks/:id`

Partial updates allowed. Secret remains unchanged unless explicitly rotated.

---

### Delete Webhook

**DELETE** `/webhooks/:id`

Hard delete with cascade to events/deliveries.

---

### Rotate Secret

**POST** `/webhooks/:id/rotate-secret`

Generates new secret, returns preview only.

---

### Activate / Deactivate

**POST** `/webhooks/:id/activate`
**POST** `/webhooks/:id/deactivate`

---

### Test Delivery

**POST** `/webhooks/:id/test`

Queues a test event for the webhook.

---

## 5.2 Event Type Endpoints

| Method | Path                    | Auth           | Description                        |
| ------ | ----------------------- | -------------- | ---------------------------------- |
| GET    | `/webhooks/event-types` | JWT or API Key | List supported webhook event types |

---

## 5.3 Delivery Log Endpoints

| Method | Path                                       | Auth           | Description                             |
| ------ | ------------------------------------------ | -------------- | --------------------------------------- |
| GET    | `/webhooks/:id/events`                     | JWT or API Key | List events for a webhook               |
| GET    | `/webhooks/:id/events/:eventId`            | JWT or API Key | Get a single webhook event              |
| GET    | `/webhooks/:id/events/:eventId/deliveries` | JWT or API Key | Get delivery attempts for an event      |
| GET    | `/webhook-deliveries`                      | JWT or API Key | List delivery logs across user webhooks |
| POST   | `/webhooks/:id/events/:eventId/retry`      | JWT or API Key | Manually retry a failed event           |

---

## 6. Authentication & Authorization

All endpoints use `CombinedAuthGuard`. Owner-scoped: users can only access their own webhooks.

---

## 7. Webhook Event Processing

1. Platform action emits domain event
2. Query active webhooks subscribed to event type
3. Create `WebhookEvent` per matching webhook
4. Queue for async processing

Queue: database-backed polling worker (no Redis dependency).

---

## 8. Delivery Protocol

HTTP POST with headers: Content-Type, User-Agent, X-Webhook-Id, X-Webhook-Event-Id, X-Webhook-Event-Type, X-Webhook-Timestamp, X-Webhook-Signature.

---

## 9. HMAC-SHA256 Signing

```
signedPayload = `${timestamp}.${rawBody}`
signature = HMAC_SHA256(secret, signedPayload)
Header: X-Webhook-Signature: sha256=<hex>
```

---

## 10. Retry Logic

| Attempt | Delay  |
| ------- | ------ |
| 1       | 10s    |
| 2       | 30s    |
| 3       | 2m     |
| 4       | 10m    |
| 5       | 30m    |

Retry on: network errors, timeouts, 5xx, 429. No retry on 4xx (except 429). Max 5 attempts.

---

## 11. Security

* HTTPS-only URLs
* SSRF protection (reject localhost, private IPs)
* 5s delivery timeout
* Secrets encrypted at rest
* Mask secrets in responses/logs

---

## 12. Acceptance Criteria

1. CRUD for webhooks with owner-scoped access
2. Event types catalog API
3. Async event processing with delivery
4. HMAC-SHA256 signatures on all deliveries
5. Delivery logging for every attempt
6. Exponential backoff retries (10s, 30s, 2m, 10m, 30m)
7. Max 5 attempts
8. SSRF protection on URLs
9. 5s delivery timeout
10. All responses use `{ data, message, statusCode }` wrapper
