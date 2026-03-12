# PR Review Scoring Rubric

## Scoring Categories

Each category is evaluated by CodeRabbit (AI review) and SonarCloud (static analysis).

| Category | Weight | Evaluated By |
|----------|--------|-------------|
| Correctness | 25% | CodeRabbit + CI tests |
| Security | 20% | CodeRabbit + SonarCloud |
| Architecture | 20% | CodeRabbit |
| Test Coverage | 20% | SonarCloud + Jest coverage |
| Maintainability | 15% | CodeRabbit + SonarCloud |

## Score Definitions (1-10 per category)

### Correctness (25%)
- **9-10**: All endpoints work. Edge cases handled. No logic errors.
- **7-8**: Works correctly with minor edge case gaps.
- **5-6**: Core flow works but some scenarios fail.
- **3-4**: Significant logic errors.
- **1-2**: Does not function.

### Security (20%)
- **9-10**: All endpoints guarded. Input validated. Passwords hashed. JWT configured. No sensitive data in responses. Rate limiting applied.
- **7-8**: Guards present, minor gaps.
- **5-6**: Some endpoints unprotected. Weak validation.
- **3-4**: Passwords in plain text. No auth guards.
- **1-2**: SQL injection possible. Secrets in code.

### Architecture (20%)
- **9-10**: Proper NestJS module boundaries. Single responsibility. Clean DI. DTOs separate from entities. No circular deps.
- **7-8**: Good structure, minor coupling.
- **5-6**: Business logic in controllers.
- **3-4**: God services. No separation.
- **1-2**: Everything in one file.

### Test Coverage (20%)
- **9-10**: >80% coverage. Unit + e2e. Edge cases. Proper mocking.
- **7-8**: 60-80%. Happy paths + major errors.
- **5-6**: 40-60%. Only happy paths.
- **3-4**: <40%. Trivial tests.
- **1-2**: No tests.

### Maintainability (15%)
- **9-10**: Clean TypeScript. No `any`. Consistent naming. Small functions. DRY. Swagger docs complete.
- **7-8**: Minor style issues.
- **5-6**: Long functions. Inconsistent patterns.
- **3-4**: Code smells. Duplication.
- **1-2**: Unreadable.

## Grade Thresholds

| Weighted Score | Grade | Action |
|---------------|-------|--------|
| 85-100 | A | **MERGE** |
| 70-84 | B | Merge with minor fixes |
| 50-69 | C | **REQUEST CHANGES** — iterate with AI |
| Below 50 | D/F | **REJECT** — major rework needed |

## How Scores Are Captured

1. **CodeRabbit** auto-comments on the PR with categorized feedback
2. **SonarCloud** reports: coverage %, code smells, security hotspots, duplications
3. **Human** reads both and records the composite score in `docs/reviews/{feature}-review.md`

## Review Scorecard Template

```markdown
# PR Review: {FEATURE_NAME}
**Branch**: feat/{feature}
**Date**: YYYY-MM-DD
**PR**: #{number}

## Automated Scores

### CodeRabbit Summary
- Critical issues: X
- Suggestions: X
- Approval status: APPROVED / CHANGES_REQUESTED

### SonarCloud Summary
- Coverage: X%
- Code smells: X
- Security hotspots: X
- Duplications: X%
- Quality gate: PASSED / FAILED

## Manual Assessment

| Category | Score (1-10) | Weight | Weighted |
|----------|-------------|--------|----------|
| Correctness | /10 | 25% | /25 |
| Security | /10 | 20% | /20 |
| Architecture | /10 | 20% | /20 |
| Test Coverage | /10 | 20% | /20 |
| Maintainability | /10 | 15% | /15 |
| **Total** | | | **/100** |

## Issues Found
1. (list issues)

## Verdict
MERGE / REQUEST_CHANGES / REJECT

## Iterations
- Iteration 1: Score X → issues: [...]
- Iteration 2: Score Y → MERGED
```
