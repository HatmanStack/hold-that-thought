# Letters Archive Feature - Implementation Plan

## Feature Overview

This implementation transforms the Hold That Thought family letters system from a static file-based approach to a dynamic, database-backed architecture. Currently, family letters are stored as markdown files in an S3 bucket (`urara/` folder) with inconsistent naming, served via SvelteKit static routes with frontmatter processing.

The new system introduces:
1. **New S3 bucket** (`hold-that-thought-archive`) as the single source of truth for letters (markdown + PDFs), media uploads, and deployment artifacts
2. **DynamoDB-backed letter storage** with version history, enabling authenticated users to edit letter content while preserving access to original PDFs
3. **Date-based naming convention** (e.g., `2016-02-10.md`, `2016-02-10.pdf`) extracted from letter content
4. **Hybrid frontend architecture**: static index page with dynamic letter content fetched from API
5. **Split-view markdown editor** with version history and revert capability

The migration includes removing all frontmatter processing from both markdown files and frontend code, retiring the old bucket, and updating the deploy script to prompt for the letters S3 source location during deployment.

## Prerequisites

### Required Tools
- Node.js v24 LTS (via nvm)
- pnpm 9.10.0+
- AWS CLI configured with appropriate credentials
- AWS SAM CLI for Lambda deployment

### Environment Setup
- Clone repository and run `pnpm install`
- Copy `.env.example` to `.env` (deployment will populate values)
- Ensure AWS credentials have permissions for: S3, DynamoDB, CloudFormation, Lambda, API Gateway, Cognito

### AWS Resources (Created by Deployment)
- S3 bucket: `hold-that-thought-archive`
- DynamoDB table: `HoldThatThought` (extended schema)
- Lambda functions (extended API)

## Phase Summary

| Phase | Goal | Estimated Tokens |
|-------|------|------------------|
| 0 | Foundation: ADRs, deployment script updates, testing strategy, shared patterns | ~15,000 |
| 1 | S3 Migration & Data Transformation: New bucket, rename files, strip frontmatter, migrate media | ~35,000 |
| 2 | Backend: DynamoDB schema extension, Letters API (CRUD + versions), deploy-time population | ~30,000 |
| 3 | Frontend: Remove frontmatter, dynamic letter fetching, split-view editor, version UI | ~20,000 |

**Total Estimated Tokens: ~100,000** (fits in single extended context window)

## Navigation

- [Phase-0.md](./Phase-0.md) - Foundation (ADRs, Deploy Script, Testing Strategy)
- [Phase-1.md](./Phase-1.md) - S3 Migration & Data Transformation
- [Phase-2.md](./Phase-2.md) - Backend: DynamoDB & Letters API
- [Phase-3.md](./Phase-3.md) - Frontend: Dynamic Letters & Editor

## Key Architecture Decisions

See [Phase-0.md](./Phase-0.md) for detailed ADRs covering:
- ADR-001: Single S3 bucket for all content
- ADR-002: Date-based naming with collision handling
- ADR-003: DynamoDB version history pattern
- ADR-004: Hybrid static/dynamic frontend architecture
- ADR-005: Frontmatter elimination strategy

## Development Workflow

1. **Read Phase-0** first - establishes patterns all phases follow
2. **Complete phases sequentially** - each builds on previous
3. **Run tests after each task** - TDD approach
4. **Commit frequently** - atomic commits with conventional format
5. **Deploy locally** - use `npm run deploy` (never `sam --guided`)
