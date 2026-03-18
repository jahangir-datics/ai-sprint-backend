# Feature 4: Audit Trail + Activity Feed

Comprehensive spec for audit logging via interceptor and user activity feed.
See full spec in conversation history.

## Key Points
- AuditInterceptor: auto-logs POST/PUT/PATCH/DELETE mutations
- AuditLog: admin-only query endpoints with rich filtering
- Activity: user-scoped timeline of meaningful actions
- Sanitization: redact passwords, tokens, secrets from logged payloads
- Append-only: no update/delete endpoints for audit logs
