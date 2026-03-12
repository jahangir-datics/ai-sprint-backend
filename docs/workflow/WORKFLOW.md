# AI-First Multi-Agent Development Workflow

## Overview

This document describes our multi-agent SDLC workflow where **5 distinct AI tools** collaborate across the software development lifecycle. The engineer acts as a supervisor — guiding, approving, and intervening — while AI agents handle spec writing, planning, implementation, testing, and code review.

## The 5 Agents

| # | Agent | Tool | SDLC Phase | Input | Output |
|---|-------|------|-----------|-------|--------|
| 1 | **Spec Agent** | ChatGPT | Requirements | Feature intent from human | Feature spec (`docs/specs/{feature}-spec.md`) |
| 2 | **Planner Agent** | Claude Code CLI | Design | Approved spec | Implementation plan (`docs/plans/{feature}-plan.md`) |
| 3 | **Coder Agent** | Claude Code CLI | Implementation | Approved plan + spec | Working code on feature branch |
| 4 | **CI Agent** | GitHub Actions | Verification | Git push | Test results + lint report |
| 5 | **Reviewer Agent** | CodeRabbit + SonarCloud | Review | Pull request | PR review comments + quality scores |

## Workflow Per Feature

```
Human provides feature intent
       ↓
[1] ChatGPT (Spec Agent)
    → Generates feature specification
    → Includes: API endpoints, data models, business rules,
      validation, security, acceptance criteria
    → Output: docs/specs/{feature}-spec.md
       ↓
  ✋ HUMAN REVIEW → approve / request changes
       ↓
[2] Claude Code (Planner Agent)
    → Reads approved spec
    → Generates step-by-step implementation plan
    → Includes: files to create, Prisma changes, test plan
    → Output: docs/plans/{feature}-plan.md
       ↓
  ✋ HUMAN REVIEW → approve / request changes
       ↓
[3] Claude Code (Coder Agent)
    → Reads spec + plan
    → Creates feature branch: feat/{feature}
    → Implements: models, services, controllers, DTOs, guards
    → Makes atomic commits per logical step
    → Does NOT write tests (Test Agent handles that)
       ↓
  ✋ HUMAN REVIEW → quick sanity check (compiles?)
       ↓
[4] Claude Code (Test Agent)
    → Reads spec (acceptance criteria) + implemented code
    → Writes unit tests (*.spec.ts) + e2e tests (*.e2e-spec.ts)
    → Commits tests to same branch
    → Runs: npm test -- --coverage
       ↓
[5] Git Push → GitHub Actions (CI Agent)
    → Runs: npm run lint
    → Runs: npm test -- --coverage
    → Reports pass/fail status on PR
       ↓
[6] Create Pull Request → CodeRabbit (Reviewer Agent)
    → Auto-reviews PR with line-by-line comments
    → Evaluates: correctness, security, architecture, maintainability
    → SonarCloud: code quality, security hotspots, coverage %
       ↓
[7] Score Evaluation
    → If CodeRabbit approves + SonarCloud passes → MERGE
    → If issues found → Claude Code fixes → re-push → re-review
       ↓
  ✋ HUMAN MERGES PR
```

## Why Multiple Tools (Not Just One)

| Approach | Limitation |
|----------|-----------|
| Single AI tool with different prompts | Same model reviewing its own code = confirmation bias |
| Custom-built PR review script | Reinventing the wheel; not production-ready |
| **Our approach: real tools orchestrated** | Each tool is best-in-class for its role; no self-review bias |

**Key insight**: CodeRabbit and SonarCloud review code they didn't write, eliminating self-review bias. GitHub Actions provides deterministic verification (tests either pass or fail). ChatGPT brings conversational iteration for specs. Claude Code brings repo-awareness for implementation.

## Merge Rule

- All GitHub Actions checks must pass (tests + lint)
- CodeRabbit must not flag critical issues
- SonarCloud quality gate must pass
- Human supervisor gives final approval

## Iteration Loop

```
If review finds issues:
  → Human reads CodeRabbit comments
  → Human instructs Claude Code to fix specific issues
  → Claude Code updates code on same branch
  → Git push triggers CI + CodeRabbit re-review
  → Repeat until clean
```

## Metrics Tracked

For each feature, we record:
- Time per agent phase (spec, plan, code, test, review)
- Number of iterations needed
- CodeRabbit review summary
- SonarCloud metrics (coverage %, code smells, security hotspots)
- Total time from intent to merge
