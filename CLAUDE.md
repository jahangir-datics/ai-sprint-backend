# AI Sprint Backend

## Project Overview
A Developer Platform API built with NestJS, demonstrating an AI-first multi-agent development workflow. This project was created as part of a 2-day AI-First Backend Engineering Sprint at Datics AI.

## Stack
- **Framework**: NestJS 11 + TypeScript (strict mode)
- **ORM**: Prisma with PostgreSQL 16
- **Auth**: Passport.js (JWT strategy + API Key strategy)
- **Validation**: class-validator + class-transformer
- **Docs**: @nestjs/swagger (Swagger UI at /api/docs)
- **Testing**: Jest (unit) + Supertest (e2e)
- **Rate Limiting**: @nestjs/throttler

## 4 Features Being Built
1. **Auth + API Key Management** — JWT auth, refresh tokens, programmable API keys with dual-auth (JWT or API key)
2. **Webhook System** — Register endpoint URLs, queue events, retry with exponential backoff, HMAC signatures, delivery logs
3. **Feature Flags** — Create/evaluate flags per user or percentage rollout, gradual releases
4. **Audit Trail + Activity Feed** — Auto-log all mutations via NestJS interceptor, queryable timeline with filters & pagination

## Multi-Agent Workflow
Each feature follows this pipeline:
1. **ChatGPT** generates the feature spec → saved to `docs/specs/{feature}-spec.md`
2. **Claude Code** generates the implementation plan → saved to `docs/plans/{feature}-plan.md`
3. **Human reviews and approves**
4. **Claude Code** implements on feature branch `feat/{feature}`
5. **Claude Code** generates tests
6. **Git push** triggers **GitHub Actions** CI (tests + lint)
7. **PR created** → **CodeRabbit** auto-reviews with scores
8. **SonarCloud** provides code quality + coverage metrics
9. Score ≥ 85 → merge; else Claude Code fixes → re-push → re-review

## Coding Conventions
- One NestJS module per feature: `auth/`, `webhooks/`, `feature-flags/`, `audit/`
- DTOs in `dto/` subfolder within each module
- Guards in `guards/` subfolder or shared `common/` module
- PrismaService as a global module
- All endpoints return consistent shape: `{ data, message, statusCode }`
- Use UUID for all primary keys
- Passwords hashed with bcrypt (10 rounds)
- JWT access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- API keys use format: `ask_` prefix + 32 random hex chars, stored as SHA-256 hash
- Use class-validator decorators on all DTOs
- Add @ApiTags, @ApiOperation, @ApiResponse Swagger decorators to all controllers

## Commands
```bash
# Local development
docker-compose up -d                    # Start PostgreSQL
npx prisma migrate dev --name <name>    # Run migration
npx prisma generate                     # Generate Prisma client
npm run start:dev                       # Start NestJS (watch mode)

# Testing
npm test                                # Unit tests
npm run test:e2e                        # E2E tests
npm run test:cov                        # Coverage report

# Build
npm run build                           # Production build
npm run lint                            # ESLint check
```

## Project Structure
```
src/
  main.ts                    # Bootstrap + Swagger setup
  app.module.ts              # Root module
  common/
    decorators/              # @Roles(), @Public(), @CurrentUser()
    filters/                 # HttpExceptionFilter
    guards/                  # JwtAuthGuard, RolesGuard, ApiKeyGuard
    interceptors/            # AuditInterceptor, TransformInterceptor
    dto/                     # PaginationDto, ApiResponseDto
  prisma/
    prisma.module.ts
    prisma.service.ts
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    strategies/              # JwtStrategy, LocalStrategy, ApiKeyStrategy
    guards/
    dto/
  api-keys/
    api-keys.module.ts
    api-keys.controller.ts
    api-keys.service.ts
    dto/
  webhooks/
    webhooks.module.ts
    webhooks.controller.ts
    webhooks.service.ts
    webhooks.processor.ts   # Event queue + retry logic
    dto/
  feature-flags/
    feature-flags.module.ts
    feature-flags.controller.ts
    feature-flags.service.ts
    dto/
  audit/
    audit.module.ts
    audit.controller.ts
    audit.service.ts
    audit.interceptor.ts
    dto/
  activity/
    activity.module.ts
    activity.controller.ts
    activity.service.ts
    dto/
prisma/
  schema.prisma
  migrations/
docs/
  specs/                     # Feature specifications (from ChatGPT)
  plans/                     # Implementation plans (from Claude Code)
  reviews/                   # PR review scorecards
  workflow/
    WORKFLOW.md              # Multi-agent pipeline explanation
    AGENT_PROMPTS.md         # Prompt templates for each tool
    SCORING_RUBRIC.md        # PR review scoring system
```

## Environment Variables
```
DATABASE_URL=postgresql://sprint:sprint123@localhost:5433/ai_sprint_db?schema=public
JWT_SECRET=<random-64-char-string>
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PORT=3000
```

## Git Workflow
- `main` branch is protected
- Each feature gets a branch: `feat/auth`, `feat/webhooks`, `feat/feature-flags`, `feat/audit-activity`
- PRs require CodeRabbit review before merge
- Commit messages follow Conventional Commits: `feat(auth): add login endpoint`
