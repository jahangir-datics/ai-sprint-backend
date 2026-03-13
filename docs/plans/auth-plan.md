# Auth + API Key Management — Implementation Plan

## 1. Files to Create/Modify

| # | File | Purpose |
|---|------|---------|
| 1 | `src/common/decorators/public.decorator.ts` | `@Public()` decorator to skip auth on specific routes |
| 2 | `src/common/decorators/current-user.decorator.ts` | `@CurrentUser()` param decorator to extract user from request |
| 3 | `src/common/decorators/roles.decorator.ts` | `@Roles()` decorator for role-based access |
| 4 | `src/common/decorators/index.ts` | Barrel export for decorators |
| 5 | `src/common/guards/roles.guard.ts` | RolesGuard — enforces `@Roles()` |
| 6 | `src/common/dto/api-response.dto.ts` | Standard `{ data, message, statusCode }` response wrapper |
| 7 | `src/common/interceptors/transform.interceptor.ts` | Wraps all responses in standard format |
| 8 | `src/auth/dto/register.dto.ts` | RegisterDto with validation |
| 9 | `src/auth/dto/login.dto.ts` | LoginDto with validation |
| 10 | `src/auth/dto/refresh-token.dto.ts` | RefreshTokenDto with validation |
| 11 | `src/auth/dto/auth-response.dto.ts` | Response DTOs for Swagger docs |
| 12 | `src/auth/strategies/jwt.strategy.ts` | Passport JWT strategy |
| 13 | `src/auth/strategies/local.strategy.ts` | Passport local strategy (email/password) |
| 14 | `src/auth/strategies/api-key.strategy.ts` | Custom Passport strategy for X-API-Key header |
| 15 | `src/auth/guards/jwt-auth.guard.ts` | JwtAuthGuard — handles `@Public()` bypass |
| 16 | `src/auth/guards/local-auth.guard.ts` | LocalAuthGuard for login endpoint |
| 17 | `src/auth/guards/api-key-auth.guard.ts` | ApiKeyAuthGuard |
| 18 | `src/auth/guards/combined-auth.guard.ts` | Tries JWT first, falls back to API key |
| 19 | `src/auth/auth.service.ts` | Auth business logic (register, login, refresh, logout) |
| 20 | `src/auth/auth.controller.ts` | Auth endpoints (/auth/*) |
| 21 | `src/auth/auth.module.ts` | Auth module wiring |
| 22 | `src/api-keys/dto/create-api-key.dto.ts` | CreateApiKeyDto with validation |
| 23 | `src/api-keys/dto/api-key-response.dto.ts` | Response DTOs for Swagger |
| 24 | `src/api-keys/api-keys.service.ts` | API key CRUD + hashing logic |
| 25 | `src/api-keys/api-keys.controller.ts` | API key endpoints (/api-keys/*) |
| 26 | `src/api-keys/api-keys.module.ts` | API keys module wiring |
| 27 | `src/app.module.ts` | **Modify** — import AuthModule, ApiKeysModule |

## 2. Prisma Schema Changes

**None required.** The schema already defines `User`, `RefreshToken`, `ApiKey`, and `Role` enum exactly as needed. Just need to run migration:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## 3. Implementation Steps

### Step 1: Prisma Migration + Generate Client

- Run `npx prisma migrate dev --name init` to create the database tables
- Run `npx prisma generate` to generate the typed client
- Dependencies: None

### Step 2: Common Decorators + DTOs

- Files: `src/common/decorators/public.decorator.ts`, `current-user.decorator.ts`, `roles.decorator.ts`, `index.ts`, `src/common/dto/api-response.dto.ts`
- `@Public()` — uses `SetMetadata('isPublic', true)`
- `@CurrentUser()` — uses `createParamDecorator` to extract `request.user`
- `@Roles(...roles)` — uses `SetMetadata('roles', roles)`
- `ApiResponseDto<T>` — generic wrapper with `data`, `message`, `statusCode`
- Dependencies: None

### Step 3: Transform Interceptor

- File: `src/common/interceptors/transform.interceptor.ts`
- NestJS interceptor that wraps all controller return values in `{ data, message, statusCode }`
- Register as global interceptor in AuthModule or AppModule
- Dependencies: Step 2 (ApiResponseDto)

### Step 4: Auth DTOs

- Files: `src/auth/dto/register.dto.ts`, `login.dto.ts`, `refresh-token.dto.ts`, `auth-response.dto.ts`
- `RegisterDto`: email (`@IsEmail`), password (`@IsString`, `@MinLength(8)`), name (`@IsOptional`, `@IsString`)
- `LoginDto`: email (`@IsEmail`), password (`@IsString`)
- `RefreshTokenDto`: refreshToken (`@IsString`)
- Response DTOs for Swagger: `LoginResponseDto`, `RegisterResponseDto`, `UserProfileDto`
- Dependencies: None

### Step 5: Auth Service

- File: `src/auth/auth.service.ts`
- `register(dto)`: Check email uniqueness → hash password with bcrypt(10) → create user → return user (no password)
- `validateUser(email, password)`: Find user → check isActive → compare bcrypt → return user or null
- `login(user)`: Generate JWT access token (15m) → generate refresh token (UUID, 7d) → store refresh token in DB → return tokens
- `refresh(refreshToken)`: Find token in DB → check expiry → generate new access token → return it
- `logout(refreshToken)`: Delete refresh token from DB
- `getProfile(userId)`: Return user without password
- Dependencies: Step 2 (decorators), PrismaService, JwtService

### Step 6: Passport Strategies

- Files: `src/auth/strategies/jwt.strategy.ts`, `local.strategy.ts`, `api-key.strategy.ts`
- **JwtStrategy**: Extracts JWT from Bearer header, validates, attaches `{ userId, email, role }` to request
- **LocalStrategy**: Validates email/password via `authService.validateUser()`
- **ApiKeyStrategy**: Custom strategy — reads `X-API-Key` header → SHA-256 hash → lookup in DB → check not revoked/expired → update `lastUsedAt` → attach user to request
- Dependencies: Step 5 (AuthService)

### Step 7: Auth Guards

- Files: `src/auth/guards/jwt-auth.guard.ts`, `local-auth.guard.ts`, `api-key-auth.guard.ts`, `combined-auth.guard.ts`
- **JwtAuthGuard**: Extends `AuthGuard('jwt')`, checks for `@Public()` metadata to skip
- **LocalAuthGuard**: Extends `AuthGuard('local')` — used only on login endpoint
- **ApiKeyAuthGuard**: Extends `AuthGuard('api-key')`
- **CombinedAuthGuard**: Tries JWT first; if no Bearer token, tries API key; if neither, reject
- Dependencies: Step 2 (@Public decorator), Step 6 (strategies)

### Step 8: Auth Controller + Module

- Files: `src/auth/auth.controller.ts`, `src/auth/auth.module.ts`
- Controller endpoints:
  - `POST /auth/register` — `@Public()`, uses RegisterDto
  - `POST /auth/login` — `@Public()`, `@UseGuards(LocalAuthGuard)`, uses LoginDto
  - `POST /auth/refresh` — `@Public()`, uses RefreshTokenDto
  - `POST /auth/logout` — uses `@CurrentUser()`, RefreshTokenDto
  - `GET /auth/me` — uses `@CurrentUser()`
- All endpoints have `@ApiTags('Auth')`, `@ApiOperation`, `@ApiResponse` decorators
- Module: imports `JwtModule.registerAsync()` (from ConfigService), `PassportModule`; provides AuthService, strategies, guards; exports AuthService, JwtModule
- Register `JwtAuthGuard` as global guard (`APP_GUARD`)
- Dependencies: Steps 4-7

### Step 9: RolesGuard

- File: `src/common/guards/roles.guard.ts`
- Reads `@Roles()` metadata, checks `request.user.role` against allowed roles
- Register as global guard (`APP_GUARD`) after JwtAuthGuard
- Dependencies: Step 2 (@Roles decorator)

### Step 10: API Key DTOs

- Files: `src/api-keys/dto/create-api-key.dto.ts`, `api-key-response.dto.ts`
- `CreateApiKeyDto`: name (`@IsString`), scopes (`@IsArray`, `@IsOptional`), expiresAt (`@IsOptional`, `@IsDateString`)
- Response DTOs for Swagger documentation
- Dependencies: None

### Step 11: API Keys Service

- File: `src/api-keys/api-keys.service.ts`
- `create(userId, dto)`: Generate `ask_` + 32 hex chars → SHA-256 hash → store hash + prefix (first 8 chars) → return full key (only time it's visible)
- `findAllByUser(userId)`: Return all non-revoked keys (without hash)
- `revoke(id, userId)`: Find key owned by user → set `isRevoked = true`
- `validateApiKey(rawKey)`: SHA-256 hash → lookup → check revoked/expired → update `lastUsedAt` → return user
- Dependencies: PrismaService

### Step 12: API Keys Controller + Module

- Files: `src/api-keys/api-keys.controller.ts`, `src/api-keys/api-keys.module.ts`
- Controller endpoints:
  - `GET /api-keys` — `@CurrentUser()`, returns list
  - `POST /api-keys` — `@CurrentUser()`, uses CreateApiKeyDto
  - `DELETE /api-keys/:id` — `@CurrentUser()`, revokes key
- All endpoints have `@ApiTags('API Keys')`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth()`
- Module: provides ApiKeysService; exports ApiKeysService (needed by ApiKeyStrategy)
- Dependencies: Steps 10-11

### Step 13: Wire Up App Module

- File: `src/app.module.ts`
- Import `AuthModule` and `ApiKeysModule`
- Register `TransformInterceptor` as global interceptor
- Dependencies: Steps 8, 9, 12

### Step 14: Build + Verify

- Run `npx prisma generate && npm run build`
- Confirm zero compilation errors
- Dependencies: All previous steps

## 4. Test Plan

### Unit Tests

| File | Tests |
|------|-------|
| `src/auth/auth.service.spec.ts` | Register (success, duplicate email), validate user (correct/wrong password, inactive account), login (token generation), refresh (valid/expired/invalid token), logout |
| `src/api-keys/api-keys.service.spec.ts` | Create key (format, hash storage), list keys (filtered by user), revoke (success, not found, wrong owner), validate key (valid, revoked, expired) |
| `src/auth/guards/jwt-auth.guard.spec.ts` | Public route bypass, protected route enforcement |
| `src/common/guards/roles.guard.spec.ts` | Role allowed, role denied, no roles decorator |
| `src/common/interceptors/transform.interceptor.spec.ts` | Response wrapping format |

### E2E Tests

| File | Tests |
|------|-------|
| `test/auth.e2e-spec.ts` | Full auth flow: register → login → me → refresh → logout; duplicate email; invalid credentials; inactive user; expired refresh token |
| `test/api-keys.e2e-spec.ts` | Create key → list → use key for auth → revoke → verify revoked key fails; expired key rejection |

## 5. Checklist

- [ ] Prisma migration created (`init`)
- [ ] Prisma client generated
- [ ] No new env variables needed (JWT_SECRET, JWT_EXPIRY already defined in .env)
- [ ] Swagger decorators on all endpoints
- [ ] All DTOs use class-validator
- [ ] Global JwtAuthGuard with @Public() bypass
- [ ] Global RolesGuard
- [ ] Global TransformInterceptor
- [ ] API key shown only once on creation
- [ ] Dual auth (JWT + API key) working
- [ ] Rate limiting on login endpoint (ThrottlerGuard)
- [ ] Build passes with zero errors
