# Feature 3: Feature Flags System

## 1. Overview & Goals

The Feature Flags system enables controlled rollout of features across users, roles, and environments without redeploying code.

### Goals

* Enable/disable features dynamically
* Gradual rollout via percentage-based release
* Target specific users or roles
* Ensure deterministic behavior (same user = same result)
* Provide a fast evaluation endpoint for runtime checks

## 2. Prisma Schema

Uses the existing FeatureFlag model. Minor additions: `environment`, `createdBy`, `updatedBy` fields for auditability.

## 3. API Endpoints

### CRUD (Admin only)

| Method | Endpoint             | Description           |
| ------ | -------------------- | --------------------- |
| POST   | `/feature-flags`     | Create a feature flag |
| GET    | `/feature-flags`     | List all flags        |
| GET    | `/feature-flags/:id` | Get flag by ID        |
| PATCH  | `/feature-flags/:id` | Update flag           |
| DELETE | `/feature-flags/:id` | Delete flag           |

### Evaluation (JWT or API key)

| Method | Endpoint                      | Description                |
| ------ | ----------------------------- | -------------------------- |
| POST   | `/feature-flags/evaluate`     | Evaluate flag for user     |

## 4. Authentication

- CRUD endpoints: CombinedAuthGuard + RolesGuard (ADMIN only)
- Evaluation endpoint: CombinedAuthGuard (JWT or API key)

## 5. Evaluation Logic

Order: isEnabled check -> targetUsers match -> targetRoles match -> percentage rollout

Reasons: FLAG_DISABLED, USER_TARGETED, ROLE_MATCH, ROLLOUT_MATCH, NOT_IN_ROLLOUT, FLAG_NOT_FOUND

## 6. Percentage Rollout

Deterministic: sha256(flagKey + userId) -> parseInt(hex.substring(0,8), 16) % 100

## 7. Error Handling

- Flag not found: 404
- Missing userId in evaluate: 400
- rolloutPercent > 100: 400
- Duplicate key: 409

## 8. Security

- CRUD restricted to ADMIN role
- Evaluation response only returns { enabled, reason }
- Rate limit evaluation endpoint
