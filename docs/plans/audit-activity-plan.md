# Implementation Plan: Feature 4 — Audit Trail + Activity Feed

**Branch**: `feat/audit-activity`
**Base**: `main`

## Steps

### 1. Update Prisma Schema
Add `method`, `path`, `requestBody`, `responseBody`, `success` to AuditLog.
Add `resource`, `resourceId` to Activity.

### 2. AuditService + AuditController
- `create(data)` — append-only log creation
- `findAll(query)` — paginated, filterable (userId, resource, action, date range, success)
- `findOne(id)` — single log detail
- Admin-only via RolesGuard

### 3. AuditInterceptor
- Global interceptor on all POST/PUT/PATCH/DELETE
- Captures userId, method, path, resource, resourceId, IP, user-agent
- Sanitizes request/response bodies (redact passwords, tokens, secrets)
- Logs on success (tap) and error (catchError)
- Non-blocking: audit failures logged but don't break requests

### 4. ActivityService + ActivityController
- `create(data)` — explicit creation from business layer
- `findAll(userId, query)` — user-scoped, filterable by type/date
- `findOne(userId, id)` — ownership-verified
- Any authenticated user (no admin restriction)

### 5. Sanitization Utility
- `sanitizeBody(obj)` — redact SENSITIVE_KEYS, truncate large payloads
- Shared by interceptor

### 6. DTOs
- `query-audit-logs.dto.ts` — all filters from spec
- `query-activity.dto.ts` — type, from, to, pagination

### 7. Wire Up
- AuditModule + ActivityModule in AppModule
- AuditInterceptor as global APP_INTERCEPTOR

### 8. Unit Tests
- AuditService, ActivityService, sanitization, interceptor

### 9. E2E Tests
- Verify mutations auto-create audit logs
- Verify admin-only access on audit endpoints
- Verify user-scoped activity feed

### 10. Migration

## Files (~18)
| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify |
| `src/audit/audit.module.ts` | Create |
| `src/audit/audit.service.ts` | Create |
| `src/audit/audit.controller.ts` | Create |
| `src/audit/audit.interceptor.ts` | Create |
| `src/audit/audit.utils.ts` | Create |
| `src/audit/dto/query-audit-logs.dto.ts` | Create |
| `src/audit/audit.service.spec.ts` | Create |
| `src/audit/audit.interceptor.spec.ts` | Create |
| `src/activity/activity.module.ts` | Create |
| `src/activity/activity.service.ts` | Create |
| `src/activity/activity.controller.ts` | Create |
| `src/activity/dto/query-activity.dto.ts` | Create |
| `src/activity/activity.service.spec.ts` | Create |
| `src/app.module.ts` | Modify |
| `test/audit.e2e-spec.ts` | Create |
| `test/activity.e2e-spec.ts` | Create |
| `prisma/migrations/...` | Generated |
