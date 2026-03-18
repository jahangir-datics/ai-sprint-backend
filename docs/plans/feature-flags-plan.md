# Implementation Plan: Feature 3 — Feature Flags

**Spec**: `docs/specs/feature-flags-spec.md`
**Branch**: `feat/feature-flags`
**Base**: `main`

## Summary

CRUD management for feature flags (admin-only) plus a flag evaluation endpoint (any authenticated user). Deterministic percentage rollout using SHA-256 hash.

## Steps

### 1. Update Prisma Schema
Add `environment`, `createdBy`, `updatedBy` fields to FeatureFlag model. Add `@@index([environment])`.

### 2. DTOs
- `create-feature-flag.dto.ts` — key (required, unique slug), name, description, isEnabled, rolloutPercent (0-100), targetUsers, targetRoles, environment
- `update-feature-flag.dto.ts` — PartialType of create
- `list-feature-flags-query.dto.ts` — page, limit, environment filter
- `evaluate-flag.dto.ts` — flagKey (required), userId (required), userRoles (optional array)

### 3. FeatureFlagsService
- CRUD: create, findAll (paginated), findOne, update, remove
- `evaluate(flagKey, userId, userRoles)` — evaluation logic per spec
- `deterministicHash(input)` — SHA-256 based, returns number 0-99
- Duplicate key → ConflictException

### 4. FeatureFlagsController
- CRUD endpoints with `@Roles('ADMIN')` guard
- `POST /feature-flags/evaluate` — no roles restriction (any authenticated user)
- `evaluate` route declared before `:id` routes
- Swagger decorators on all endpoints

### 5. FeatureFlagsModule
Wire up in AppModule.

### 6. Unit Tests
- `feature-flags.service.spec.ts` — CRUD, evaluation logic (all 6 reasons), deterministic hash consistency

### 7. E2E Tests
- `test/feature-flags.e2e-spec.ts` — CRUD + evaluation flow

### 8. Migration
Add new fields to FeatureFlag table.

## Files (12)
| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify |
| `src/feature-flags/dto/create-feature-flag.dto.ts` | Create |
| `src/feature-flags/dto/update-feature-flag.dto.ts` | Create |
| `src/feature-flags/dto/list-feature-flags-query.dto.ts` | Create |
| `src/feature-flags/dto/evaluate-flag.dto.ts` | Create |
| `src/feature-flags/feature-flags.service.ts` | Create |
| `src/feature-flags/feature-flags.controller.ts` | Create |
| `src/feature-flags/feature-flags.module.ts` | Create |
| `src/feature-flags/feature-flags.service.spec.ts` | Create |
| `src/app.module.ts` | Modify |
| `test/feature-flags.e2e-spec.ts` | Create |
| `prisma/migrations/...` | Generated |
