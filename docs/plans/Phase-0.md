# Phase 0: Foundation

**Estimated Tokens:** ~15,000

This phase establishes the architectural foundation, design decisions, and shared patterns that apply to all subsequent phases. No code is written here—this is the "law" that all implementation phases must follow.

---

## Architecture Decision Records (ADRs)

### ADR-001: Monorepo Directory Structure

**Decision:** Restructure into four top-level directories: `frontend/`, `backend/`, `docs/`, `tests/`

**Context:** Current structure has fragmented code across `src/`, `lambdas/`, `scripts/`, `aws-infrastructure/`, `cloudformation/` making navigation and CI/CD difficult.

**Consequences:**
- Clear separation of concerns
- Simplified CI/CD with distinct frontend/backend pipelines
- All infrastructure lives with backend code
- SvelteKit config files remain at root (framework requirement)

### ADR-002: Single Runtime (Node.js)

**Decision:** Port all Python Lambdas to Node.js

**Context:** Two Python Lambdas (activity-aggregator, notification-processor) exist alongside seven Node.js Lambdas. Maintaining dual runtimes adds CI/CD complexity.

**Consequences:**
- Unified testing strategy (Vitest)
- Single dependency management approach (npm/pnpm)
- Simplified SAM template (one runtime)
- One-time porting effort (~100 lines per Lambda)

### ADR-003: SAM for Lambda Deployment

**Decision:** Use AWS SAM CLI for all Lambda deployments via a single `template.yaml`

**Context:** Current deployment uses individual shell scripts per Lambda. SAM provides:
- Unified infrastructure-as-code
- Local testing capability
- Automatic artifact management
- CloudFormation integration

**Consequences:**
- Single `sam deploy` command deploys all Lambdas
- Local development with `sam local invoke`
- Individual Lambda package.json files preserved (SAM builds each independently)
- Existing CloudFormation templates migrate to backend/infra/

### ADR-004: Vitest for Testing

**Decision:** Replace Jest with Vitest for all JavaScript tests

**Context:** Jest is slower and requires separate configuration. Vitest is Vite-native, faster, and has compatible API.

**Consequences:**
- Faster test execution
- Native ESM support
- Compatible with existing Jest test syntax (minimal migration)
- Root vitest.config.ts orchestrates all tests

### ADR-005: pnpm Package Manager

**Decision:** Retain pnpm as package manager

**Context:** Project already uses pnpm. Switching to npm adds unnecessary migration work.

**Consequences:**
- `pnpm-lock.yaml` preserved
- All npm scripts use pnpm commands in CI
- Workspace configuration possible for monorepo (optional future enhancement)

### ADR-006: Comment/Debug Stripping

**Decision:** Remove all inline comments, JSDoc, docstrings, console.logs, and debugger statements

**Context:** Code should be self-documenting. Development noise clutters production code.

**Consequences:**
- Cleaner codebase
- Smaller bundle sizes
- Essential architectural notes moved to docs/
- Only structured error logging remains

---

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend Framework | SvelteKit | 2.x |
| Frontend Build | Vite | 5.x |
| Backend Runtime | Node.js | 24 LTS |
| Backend Deployment | AWS SAM | 1.100+ |
| Package Manager | pnpm | 9.10+ |
| Test Runner | Vitest | Latest |
| E2E Tests | Playwright | 1.56+ |
| Load Tests | Artillery | 2.x |
| Linting | ESLint | 9.x |
| CI/CD | GitHub Actions | - |

---

## Deployment Script Specification

### Overview

The `npm run deploy` command executes `backend/scripts/deploy.js`, which:
1. Checks prerequisites (AWS CLI, SAM CLI)
2. Loads or prompts for configuration
3. Generates `samconfig.toml`
4. Runs `sam build && sam deploy`
5. Updates root `.env` with stack outputs

### Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    npm run deploy                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Check Prerequisites                                     │
│     - aws sts get-caller-identity                           │
│     - sam --version                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Load/Prompt Configuration                               │
│     - Check for backend/.deploy-config.json                 │
│     - If missing: prompt for region, stackName              │
│     - Save to .deploy-config.json (git-ignored)             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Generate samconfig.toml                                 │
│     - Build from .deploy-config.json values                 │
│     - Write to backend/samconfig.toml                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. SAM Build & Deploy                                      │
│     - sam build (from backend/)                             │
│     - sam deploy --no-confirm-changeset                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Update .env                                             │
│     - Get stack outputs via aws cloudformation              │
│     - Extract API URL                                       │
│     - Update root .env with URARA_API_URL                   │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Schema

```json
{
  "region": "us-east-1",
  "stackName": "hold-that-thought",
  "allowedOrigins": "https://holdthatthought.family"
}
```

### Generated samconfig.toml

```toml
version = 0.1
[default.deploy.parameters]
stack_name = "hold-that-thought"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "AllowedOrigins=https://holdthatthought.family"
resolve_s3 = true
```

### Files Involved

| File | Purpose | Git Status |
|------|---------|------------|
| `backend/scripts/deploy.js` | Main deployment script | Tracked |
| `backend/.deploy-config.json` | User configuration | Ignored |
| `backend/samconfig.toml` | Generated SAM config | Ignored |
| `.env` | Frontend environment variables | Ignored |

---

## Testing Strategy

### Test Categories

| Category | Location | Runner | When |
|----------|----------|--------|------|
| Unit Tests (Frontend) | `frontend/**/*.test.ts` | Vitest | CI |
| Unit Tests (Backend) | `backend/**/*.test.js` | Vitest | CI |
| Integration Tests | `tests/integration/` | Vitest | CI (mocked) |
| E2E Tests | `tests/e2e/` | Playwright | CI |
| Load Tests | `tests/load/` | Artillery | Manual |

### Mocking Approach

All CI tests run without live AWS resources:

**DynamoDB:** Use `aws-sdk-client-mock` to mock DocumentClient responses
**S3:** Mock presigned URL generation, don't hit real buckets
**Cognito:** Mock token validation, use test JWTs
**SES:** Mock send operations, verify call parameters

### Test File Patterns

```
# Unit tests colocated with source
backend/comments-api/index.test.js
backend/messages-api/index.test.js

# Integration tests in central location
tests/integration/comments.test.js
tests/integration/messages.test.js

# E2E tests
tests/e2e/comments.spec.ts
tests/e2e/messages.spec.ts
```

### CI Test Commands

```bash
# Frontend lint
pnpm lint

# Frontend type check
pnpm run check

# All unit + integration tests
pnpm test

# E2E tests
pnpm test:e2e
```

---

## GitHub Actions CI Pipeline

### Workflow Structure

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  frontend-lint:
    # ESLint + TypeScript check

  frontend-tests:
    # Vitest for frontend units

  backend-tests:
    # Vitest for backend units + integration

  e2e-tests:
    # Playwright tests

  status-check:
    # Gate job that fails if any above fail
```

### Job Dependencies

```
frontend-lint ─────┐
                   │
frontend-tests ────┼──► status-check
                   │
backend-tests ─────┤
                   │
e2e-tests ─────────┘
```

### Runtime Requirements

- **Node.js:** 24
- **pnpm:** Latest
- **Browsers:** Playwright managed

---

## Shared Patterns & Conventions

### Import Paths

After refactor, imports follow these patterns:

```javascript
// Frontend (from within frontend/)
import { auth } from '$lib/auth';
import { Button } from '$lib/components/Button.svelte';

// Backend (from within a Lambda)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Tests (from tests/)
import { handler } from '../../backend/comments-api/index.js';
```

### Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `URARA_API_URL` | `.env` | Backend API Gateway URL |
| `AWS_REGION` | Lambda env | AWS region for SDK |
| `USER_PROFILES_TABLE` | Lambda env | DynamoDB table name |
| `COMMENTS_TABLE` | Lambda env | DynamoDB table name |
| `MESSAGES_TABLE` | Lambda env | DynamoDB table name |

### Error Handling

```javascript
// Structured error response (Lambda)
return {
  statusCode: 400,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: 'Validation failed', code: 'INVALID_INPUT' })
};
```

### Commit Message Format

```
type(scope): brief description

Detail 1
Detail 2

Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`

Scopes: `frontend`, `backend`, `infra`, `ci`, `docs`

---

## File Deletions (Cleanup List Preview)

Files to be deleted or moved during refactor:

| File/Directory | Action | Phase |
|----------------|--------|-------|
| `.kiro/` | Delete | Phase-1 |
| `README.zh.md` | Delete | Phase-1 |
| `lambdas/` | Move to `backend/` | Phase-1 |
| `aws-infrastructure/` | Move to `backend/infra/` | Phase-1 |
| `cloudformation/` | Move to `backend/infra/` | Phase-1 |
| `scripts/` | Move to `backend/scripts/` | Phase-1 |
| `src/` | Rename to `frontend/` | Phase-1 |
| `backend/activity-aggregator/*.py` | Delete (rewritten as Node.js) | Phase-2 |
| `backend/notification-processor/*.py` | Delete (rewritten as Node.js) | Phase-2 |
| `backend/*/jest.config.js` | Delete (using root Vitest) | Phase-1 |
| `tests/integration/jest.config.js` | Delete (using root Vitest) | Phase-1 |

---

## Phase Dependencies

```
Phase-0 (This Document)
    │
    ▼
Phase-1: Structure Migration
    │   - Move directories
    │   - Update import paths
    │   - Create SAM template
    │
    ▼
Phase-2: Code Cleanup & Lambda Ports
    │   - Port Python Lambdas
    │   - Strip comments/debug
    │   - Consolidate docs
    │
    ▼
Phase-3: CI/CD & Final Integration
        - GitHub Actions workflow
        - Root package.json scripts
        - Migration script
        - Final verification
```
