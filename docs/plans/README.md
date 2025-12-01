# Monorepo Refactor Implementation Plan

## Overview

This plan restructures the Hold That Thought codebase from a loosely organized repository into a clean monorepo architecture with standardized CI/CD pipelines. The refactor consolidates the SvelteKit frontend, AWS Lambda backends, infrastructure-as-code, and documentation into a predictable four-directory structure (`frontend/`, `backend/`, `docs/`, `tests/`).

The migration involves moving directories, updating all import paths and asset references programmatically, porting two Python Lambdas to Node.js, stripping development noise (comments, console.logs, dead code), and implementing a SAM-based deployment workflow. The result is a maintainable codebase with automated linting, Vitest-based testing, and a single `npm run deploy` command for backend deployment.

Key deliverables include a bash migration script for reproducibility, updated GitHub Actions CI workflow, and consolidated documentation following the established pattern from similar projects.

## Prerequisites

### Required Tools
- **Node.js** v24 LTS (via nvm)
- **pnpm** v9.10+ (package manager)
- **AWS CLI** v2 configured with credentials
- **AWS SAM CLI** v1.100+ for serverless deployment
- **Git** for version control

### Environment Setup
```bash
nvm use 24
pnpm install
aws configure  # If not already configured
```

### Required Knowledge
- SvelteKit project structure and configuration
- AWS Lambda + API Gateway concepts
- SAM template.yaml syntax
- Vitest testing patterns

## Phase Summary

| Phase | Goal | Token Estimate |
|-------|------|----------------|
| [Phase-0](./Phase-0.md) | Foundation: Architecture decisions, deployment scripts, testing strategy | ~15k |
| [Phase-1](./Phase-1.md) | Structure migration: Move directories, update paths, create SAM template | ~45k |
| [Phase-2](./Phase-2.md) | Code cleanup: Port Python Lambdas, strip comments, sanitize code, consolidate docs | ~40k |
| [Phase-3](./Phase-3.md) | CI/CD integration: GitHub Actions, root package.json scripts, final verification | ~25k |

## Architecture Target

```text
hold-that-thought/
├── frontend/           # SvelteKit client (renamed from src/)
│   ├── lib/
│   ├── routes/
│   └── ...
├── backend/            # All Lambda functions + infra
│   ├── lambdas/
│   │   ├── comments-api/
│   │   ├── messages-api/
│   │   ├── profile-api/
│   │   ├── reactions-api/
│   │   ├── media-upload-lambda/
│   │   ├── pdf-download-lambda/
│   │   ├── download-presigned-url-lambda/
│   │   ├── activity-aggregator/      # Ported from Python
│   │   └── notification-processor/   # Ported from Python
│   ├── scripts/                  # Deployment scripts
│   └── template.yaml             # SAM template
├── docs/               # Consolidated documentation
├── tests/              # Centralized test suites
│   ├── e2e/            # Playwright E2E tests
│   ├── integration/    # Live API integration tests
│   ├── load/           # Artillery load tests
│   └── unit/           # Lambda handler unit tests
├── .github/workflows/  # CI configuration
├── package.json        # Root orchestration
└── [config files]      # svelte.config.js, vite.config.ts, etc.
```

## Navigation

- [Phase-0: Foundation](./Phase-0.md) - Start here
- [Phase-1: Structure Migration](./Phase-1.md)
- [Phase-2: Code Cleanup & Lambda Ports](./Phase-2.md)
- [Phase-3: CI/CD & Final Integration](./Phase-3.md)
