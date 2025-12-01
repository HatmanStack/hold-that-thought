# Phase 1: Structure Migration

**Estimated Tokens:** ~45,000

This phase moves all files to their target locations, updates import paths, creates the SAM template, and configures the deployment script. At the end of this phase, the directory structure matches the target architecture and `npm run deploy` works.

---

## Phase Goal

Restructure the codebase into the monorepo architecture defined in Phase-0. This involves:
- Moving `src/` to `frontend/`
- Moving `lambdas/` to `backend/` with consolidated infrastructure
- Updating all configuration files to reference new paths
- Creating the SAM template for unified Lambda deployment
- Implementing the deployment script

**Success Criteria:**
- Directory structure matches target architecture
- `pnpm install` succeeds
- `pnpm dev` starts the SvelteKit dev server
- `pnpm run deploy` prompts for config and generates `samconfig.toml`
- All existing tests pass with updated import paths

---

## Prerequisites

- Phase-0 complete (read and understand ADRs)
- Git working tree clean (commit or stash changes)
- Node.js 24, pnpm, AWS CLI, SAM CLI installed

---

## Tasks

### Task 1: Create Target Directory Structure

**Goal:** Create the skeleton directories for the new structure before moving files.

**Files to Create:**
- `backend/` directory
- `backend/infra/` directory
- `backend/scripts/` directory

**Prerequisites:**
- None

**Implementation Steps:**
- Create the `backend/` directory at project root
- Create `backend/infra/` subdirectory for CloudFormation templates
- Create `backend/scripts/` subdirectory for deployment scripts
- Do NOT create `frontend/` yet (will be renamed from `src/`)

**Verification Checklist:**
- [ ] `backend/` directory exists
- [ ] `backend/infra/` directory exists
- [ ] `backend/scripts/` directory exists

**Testing Instructions:**
- Run `ls -la` to verify directories exist
- No automated tests needed for directory creation

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(structure): create backend directory skeleton

- Add backend/ root directory
- Add backend/infra/ for CloudFormation templates
- Add backend/scripts/ for deployment scripts
```

---

### Task 2: Move Lambda Functions to Backend

**Goal:** Move all Lambda function directories from `lambdas/` to `backend/`, preserving their individual package.json files.

**Files to Modify/Create:**
- Move `lambdas/comments-api/` → `backend/comments-api/`
- Move `lambdas/messages-api/` → `backend/messages-api/`
- Move `lambdas/profile-api/` → `backend/lambdas/profile-api/`
- Move `lambdas/reactions-api/` → `backend/lambdas/reactions-api/`
- Move `lambdas/media-upload-lambda/` → `backend/lambdas/media-upload-lambda/`
- Move `lambdas/pdf-download-lambda/` → `backend/lambdas/pdf-download-lambda/`
- Move `lambdas/download-presigned-url-lambda/` → `backend/lambdas/download-presigned-url-lambda/`
- Move `lambdas/activity-aggregator/` → `backend/lambdas/activity-aggregator/` (temporary, will be rewritten in Phase-2)
- Move `lambdas/notification-processor/` → `backend/lambdas/notification-processor/` (temporary, will be rewritten in Phase-2)

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
- Use `git mv` to move each Lambda directory to preserve history
- Move all nine Lambda directories from `lambdas/` to `backend/`
- After all moves, delete the empty `lambdas/` directory
- Verify no files remain in `lambdas/`

**Verification Checklist:**
- [ ] `backend/lambdas/comments-api/index.js` exists
- [ ] `backend/lambdas/messages-api/index.js` exists
- [ ] `backend/lambdas/profile-api/index.js` exists
- [ ] `backend/lambdas/reactions-api/index.js` exists
- [ ] `backend/lambdas/media-upload-lambda/index.js` exists
- [ ] `backend/lambdas/pdf-download-lambda/index.js` exists
- [ ] `backend/lambdas/download-presigned-url-lambda/index.js` exists
- [ ] `backend/lambdas/activity-aggregator/index.py` exists
- [ ] `backend/lambdas/notification-processor/index.py` exists
- [ ] `lambdas/` directory no longer exists

**Testing Instructions:**
- Run `ls backend/*/index.js backend/*/index.py` to verify all handlers moved
- No code changes, so no tests to run yet

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): move Lambda functions from lambdas/ to backend/

- Move all 9 Lambda directories to backend/
- Preserve individual package.json files
- Remove empty lambdas/ directory
```

---

### Task 3: Consolidate Infrastructure to Backend

**Goal:** Move all CloudFormation/infrastructure YAML files to `backend/infra/`.

**Files to Modify/Create:**
- Move `aws-infrastructure/*.yaml` → `backend/infra/`
- Move `cloudformation/*.yaml` → `backend/infra/`
- Delete empty `aws-infrastructure/` directory
- Delete empty `cloudformation/` directory

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
- Use `git mv` to move all YAML files from `aws-infrastructure/` to `backend/infra/`
- Use `git mv` to move all YAML files from `cloudformation/` to `backend/infra/`
- Remove empty source directories
- Files to move from `aws-infrastructure/`:
  - `api-gateway-with-auth.yaml`
  - `cognito-user-pool.yaml`
  - `gallery-api-gateway.yaml`
  - `gallery-upload-lambda.yaml`
  - `lambda-integration-api-gateway.yaml`
  - `media-upload-lambda.yaml`
  - `pdf-download-lambda.yaml`
  - `signup-notification-lambda.yaml`
- Files to move from `cloudformation/`:
  - `api-gateway-extensions.yaml`
  - `dynamodb-tables.yaml`
  - `lambda-functions.yaml`
  - `monitoring.yaml`

**Verification Checklist:**
- [ ] `backend/infra/` contains 12 YAML files
- [ ] `aws-infrastructure/` directory no longer exists
- [ ] `cloudformation/` directory no longer exists

**Testing Instructions:**
- Run `ls backend/infra/*.yaml | wc -l` should output 12
- Validate YAML syntax with `yamllint backend/infra/*.yaml` (optional)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(infra): consolidate CloudFormation to backend/infra/

- Move aws-infrastructure/ contents to backend/infra/
- Move cloudformation/ contents to backend/infra/
- Remove empty source directories
```

---

### Task 4: Move Scripts to Backend

**Goal:** Move all deployment and utility scripts to `backend/scripts/`.

**Files to Modify/Create:**
- Move `scripts/*.sh` → `backend/scripts/`
- Move `scripts/*.js` → `backend/scripts/`

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
- Use `git mv` to move all files from `scripts/` to `backend/scripts/`
- Files to move:
  - `add-approved-user.js`
  - `backfill-user-profiles.js`
  - `deploy-all-infrastructure.sh`
  - `deploy-auth-infrastructure.sh`
  - `deploy-gallery-infrastructure.sh`
  - `deploy-lambda-integration-api.sh`
  - `deploy-lambdas.sh`
  - `deploy-media-upload-lambda.sh`
  - `deploy-pdf-download-lambda.sh`
  - `deploy-production.sh`
  - `deploy-signup-notifications.sh`
  - `rollback.sh`
  - `test-media-upload-endpoint.sh`
  - `test-pdf-download-endpoint.sh`
- Remove empty `scripts/` directory

**Verification Checklist:**
- [ ] `backend/scripts/` contains 14 files
- [ ] `scripts/` directory no longer exists
- [ ] Shell scripts retain executable permissions

**Testing Instructions:**
- Run `ls backend/scripts/ | wc -l` should output 14
- Run `file backend/scripts/*.sh` to verify executable type

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): move scripts to backend/scripts/

- Move all deployment scripts
- Move utility scripts
- Remove empty scripts/ directory
```

---

### Task 5: Rename src/ to frontend/

**Goal:** Rename the SvelteKit source directory from `src/` to `frontend/`.

**Files to Modify/Create:**
- Rename `src/` → `frontend/`

**Prerequisites:**
- None (independent of backend tasks)

**Implementation Steps:**
- Use `git mv src frontend` to rename the directory
- This single command moves all contents including:
  - `lib/` (components, auth, services, stores, types, utils)
  - `routes/` (all page routes)
  - `app.d.ts`, `app.html`, `app.pcss`, `hooks.server.ts`

**Verification Checklist:**
- [ ] `frontend/` directory exists
- [ ] `frontend/routes/+page.svelte` exists
- [ ] `frontend/lib/` directory exists
- [ ] `src/` directory no longer exists

**Testing Instructions:**
- Run `ls frontend/` to verify contents moved
- Build will fail until configs updated (next task)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(frontend): rename src/ to frontend/

- Rename source directory for monorepo clarity
- Configs updated in following commit
```

---

### Task 6: Update SvelteKit Configuration

**Goal:** Update all configuration files to reference `frontend/` instead of `src/`.

**Files to Modify/Create:**
- `svelte.config.js` - Add `files.lib` and `files.routes` config
- `vite.config.ts` - No changes needed (uses SvelteKit defaults)
- `tsconfig.json` - Update `paths` alias if present
- `tailwind.config.ts` - Update content paths
- `uno.config.ts` - Update content paths if using file scanning

**Prerequisites:**
- Task 5 complete

**Implementation Steps:**

**svelte.config.js:**
- Add `files` configuration to `kit` object:
  ```javascript
  kit: {
    files: {
      assets: 'static',
      lib: 'frontend/lib',
      params: 'frontend/params',
      routes: 'frontend/routes',
      serviceWorker: 'frontend/service-worker',
      appTemplate: 'frontend/app.html',
      errorTemplate: 'frontend/error.html',
      hooks: {
        client: 'frontend/hooks.client',
        server: 'frontend/hooks.server'
      }
    },
    // ... existing config
  }
  ```

**tsconfig.json:**
- Update `$lib` path alias:
  ```json
  "paths": {
    "$lib": ["frontend/lib"],
    "$lib/*": ["frontend/lib/*"]
  }
  ```

**tailwind.config.ts:**
- Update content array to scan `frontend/`:
  ```typescript
  content: [
    './frontend/**/*.{html,js,svelte,ts}',
    // ... other paths
  ]
  ```

**uno.config.ts:**
- If using file scanning, update to `frontend/` paths

**Verification Checklist:**
- [ ] `pnpm dev` starts successfully
- [ ] Hot reload works on file changes in `frontend/`
- [ ] `$lib` imports resolve correctly
- [ ] Tailwind classes apply to components

**Testing Instructions:**
- Run `pnpm dev` and verify no errors
- Make a trivial change to a component and verify HMR works
- Run `pnpm check` for TypeScript validation

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(frontend): update configs for frontend/ directory

- Update svelte.config.js files paths
- Update tsconfig.json $lib alias
- Update tailwind.config.ts content paths
```

---

### Task 7: Organize Test Structure

**Goal:** Consolidate and organize test files. The repository has two types of tests that must be distinguished:

1. **Lambda Unit Tests** (`backend/*/test/handler.test.js`) - Mock AWS SDK, test handler logic in isolation
2. **Live Integration Tests** (`tests/integration/*.test.js`) - Hit real API endpoints via HTTP

**Current State Analysis:**
- `tests/integration/comments.test.js` - Live API tests (uses `apiRequest` helper)
- `backend/comments-api/test/handler.test.js` - Unit tests (uses `aws-sdk-client-mock`)
- These are NOT duplicates - they serve different purposes

**Files to Modify/Create:**
- Move `backend/comments-api/test/handler.test.js` → `tests/unit/comments-handler.test.js`
- Move `backend/messages-api/test/handler.test.js` → `tests/unit/messages-handler.test.js`
- Move `backend/profile-api/test/handler.test.js` → `tests/unit/profile-handler.test.js`
- Move `backend/profile-api/test/security.test.js` → `tests/unit/profile-security.test.js`
- Move `backend/reactions-api/test/handler.test.js` → `tests/unit/reactions-handler.test.js`
- Create `tests/unit/` directory
- Keep `tests/integration/*.test.js` as-is (live API tests)
- Update import paths in moved test files

**Prerequisites:**
- Task 2 complete (Lambdas moved to backend/)

**Implementation Steps:**
- Create `tests/unit/` directory for Lambda unit tests
- Move Lambda test files using `git mv` with renamed filenames
- Update import statements in each moved test file:
  - Change `const { handler } = require('../index');`
  - To `const { handler } = require('../../backend/comments-api/index');`
- Remove empty `test/` directories from Lambda folders
- Remove individual `jest.config.js` files from Lambdas
- Remove `tests/integration/jest.config.js` (will use root Vitest)
- Keep `tests/integration/setup.js` (used by live API tests)

**Verification Checklist:**
- [ ] `tests/unit/` directory exists
- [ ] `tests/unit/comments-handler.test.js` exists with updated imports
- [ ] `tests/unit/messages-handler.test.js` exists with updated imports
- [ ] `tests/unit/profile-handler.test.js` exists with updated imports
- [ ] `tests/unit/reactions-handler.test.js` exists with updated imports
- [ ] `tests/integration/comments.test.js` unchanged (live API tests)
- [ ] No `test/` directories remain in `backend/*/`
- [ ] No `jest.config.js` files remain in `backend/*/` or `tests/integration/`

**Testing Instructions:**
- Tests will not run until Vitest configuration (Task 11)
- Verify structure: `ls tests/unit/*.test.js && ls tests/integration/*.test.js`

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(tests): organize unit and integration tests

- Create tests/unit/ for Lambda handler unit tests
- Move Lambda tests with updated import paths
- Keep tests/integration/ for live API tests
- Remove scattered jest.config.js files
```

---

### Task 8: Create SAM Template

**Goal:** Create a SAM template.yaml that defines all Lambda functions for unified deployment.

**Files to Create:**
- `backend/template.yaml` - SAM template defining all Lambdas

**Prerequisites:**
- Task 2 complete (Lambdas in backend/)
- Review existing CloudFormation in `backend/infra/lambda-functions.yaml` for reference

**Implementation Steps:**

Create `backend/template.yaml` with:
- SAM Transform header
- Parameters section for:
  - `AllowedOrigins` (CORS origins, default '*')
  - `UserProfilesTable` (DynamoDB table name)
  - `CommentsTable` (DynamoDB table name)
  - `MessagesTable` (DynamoDB table name)
  - `ReactionsTable` (DynamoDB table name)
  - `MediaBucket` (S3 bucket name)
- Globals section:
  - Runtime: `nodejs20.x`
  - Timeout: 30
  - MemorySize: 256
  - Architectures: x86_64
- Resources for each Lambda:
  - CommentsApiFunction
  - MessagesApiFunction
  - ProfileApiFunction
  - ReactionsApiFunction
  - MediaUploadFunction
  - PdfDownloadFunction
  - DownloadPresignedUrlFunction
  - ActivityAggregatorFunction (placeholder, updated in Phase-2)
  - NotificationProcessorFunction (placeholder, updated in Phase-2)
- Each function resource needs:
  - Type: AWS::Serverless::Function
  - Properties: CodeUri, Handler, Environment variables
  - Events: API Gateway events with appropriate paths

Reference the existing `backend/infra/lambda-functions.yaml` for environment variable names and API paths.

**SAM Template Structure:**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Hold That Thought - Lambda API Functions

Parameters:
  AllowedOrigins:
    Type: String
    Default: '*'
  # ... other parameters

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 30
    MemorySize: 256
    Architectures:
      - x86_64

Resources:
  CommentsApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: comments-api/
      Handler: index.handler
      Environment:
        Variables:
          COMMENTS_TABLE: !Ref CommentsTable
          USER_PROFILES_TABLE: !Ref UserProfilesTable
      Events:
        GetComments:
          Type: Api
          Properties:
            Path: /comments/{itemId}
            Method: get
        # ... other events

  # ... other functions

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/'
```

**Verification Checklist:**
- [ ] `backend/template.yaml` exists
- [ ] `sam validate` passes
- [ ] All 9 Lambda functions defined
- [ ] API Gateway events defined for each endpoint

**Testing Instructions:**
- Run `cd backend && sam validate` to check template syntax
- Run `sam build` to verify all CodeUri paths resolve

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): add SAM template for Lambda deployment

- Define all Lambda functions in template.yaml
- Configure API Gateway events
- Set environment variables for DynamoDB tables
- Add outputs for API URL
```

---

### Task 9: Create Deployment Script

**Goal:** Create the interactive deployment script that manages configuration, generates samconfig.toml, and runs SAM deploy.

**Files to Create:**
- `backend/scripts/deploy.js` - Main deployment script
- `backend/.gitignore` - Ignore deploy config and SAM artifacts

**Prerequisites:**
- Task 8 complete (SAM template exists)
- Read Phase-0 deployment script specification

**Implementation Steps:**

Create `backend/scripts/deploy.js` following the specification in Phase-0. The script must:

1. **Check Prerequisites**
   - Verify AWS CLI configured (`aws sts get-caller-identity`)
   - Verify SAM CLI installed (`sam --version`)
   - Exit with helpful error if missing

2. **Load or Prompt Configuration**
   - Check for `backend/.deploy-config.json`
   - If exists, load and validate
   - If missing, prompt for:
     - AWS Region (default: us-east-1)
     - Stack Name (default: hold-that-thought)
     - Allowed Origins (default: *)
   - Save responses to `.deploy-config.json`

3. **Generate samconfig.toml**
   - Build parameter_overrides from config
   - Write to `backend/samconfig.toml`

4. **Build and Deploy**
   - Run `sam build` from backend directory
   - Run `sam deploy --no-confirm-changeset --no-fail-on-empty-changeset`
   - Stream output to console

5. **Update .env**
   - Get stack outputs via `aws cloudformation describe-stacks`
   - Extract ApiUrl output
   - Update root `.env` with `URARA_API_URL=<value>`

Create `backend/.gitignore`:
```
.deploy-config.json
samconfig.toml
.aws-sam/
```

**Verification Checklist:**
- [ ] `backend/scripts/deploy.js` exists and is executable
- [ ] Script prompts for config when `.deploy-config.json` missing
- [ ] Script loads existing config without prompting
- [ ] `samconfig.toml` generated with correct values
- [ ] `.gitignore` ignores config and SAM artifacts

**Testing Instructions:**
- Run `node backend/scripts/deploy.js` and verify prompts appear
- Check generated `samconfig.toml` format
- Script tests will be added in Phase-3 (Vitest setup)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): add interactive deployment script

- Implement config loading/prompting
- Generate samconfig.toml from config
- Run sam build and deploy
- Update root .env with API URL
```

---

### Task 10: Update Root package.json Scripts

**Goal:** Update the root package.json with new script commands for the monorepo structure.

**Files to Modify:**
- `package.json` - Add/update scripts

**Prerequisites:**
- Task 6 complete (frontend config updated)
- Task 9 complete (deploy script exists)
- Task 11 complete (Vitest installed - must be installed before test scripts work)

**Implementation Steps:**

Update the scripts section in root `package.json`:

```json
{
  "scripts": {
    "dev": "run-s tsc \"dev:parallel {@} \" --",
    "dev:parallel": "run-p -r tsc:watch urara:watch \"kit:dev {@} \" --",
    "build": "run-s tsc urara:build kit:build clean",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "lint": "eslint --flag unstable_ts_config .",
    "lint:fix": "eslint --flag unstable_ts_config . --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:load": "artillery run tests/load/comments-load.yml",
    "deploy": "node backend/scripts/deploy.js",
    "clean": "node urara.js clean",
    "tsc": "tsc -p tsconfig.node.json",
    "tsc:watch": "tsc -w -p tsconfig.node.json",
    "kit:build": "cross-env NODE_OPTIONS=--max_old_space_size=7680 vite build",
    "kit:dev": "cross-env NODE_OPTIONS=--max_old_space_size=7680 vite dev",
    "urara:build": "node urara.js build",
    "urara:watch": "node urara.js watch"
  }
}
```

Key changes:
- `test`: Changed from undefined to `vitest run`
- `deploy`: Points to new deploy script
- Existing scripts preserved for SvelteKit build process

**Verification Checklist:**
- [ ] `pnpm test` invokes Vitest (will fail until Vitest configured)
- [ ] `pnpm deploy` runs the deployment script
- [ ] `pnpm dev` still works
- [ ] `pnpm build` still works

**Testing Instructions:**
- Run `pnpm dev` to verify development still works
- Run `pnpm deploy` to verify script invoked (cancel after prompts)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(root): update package.json scripts for monorepo

- Add test command for Vitest
- Add deploy command for SAM deployment
- Preserve existing SvelteKit scripts
```

---

### Task 11: Add Vitest Configuration

**Goal:** Configure Vitest as the test runner for all JavaScript tests.

**IMPORTANT:** This task must be completed BEFORE Task 10, as the test scripts in package.json depend on Vitest being installed.

**Files to Create:**
- `vitest.config.ts` - Root Vitest configuration
- Add `vitest` to devDependencies

**Prerequisites:**
- Task 7 complete (tests organized)

**Implementation Steps:**

Install Vitest (run before updating scripts):
```bash
pnpm add -D vitest@^2.1.0 @vitest/coverage-v8@^2.1.0
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.{js,ts}',
      'tests/integration/**/*.test.{js,ts}',
      'backend/**/*.test.{js,ts}'
    ],
    exclude: [
      'node_modules',
      'frontend',
      '.svelte-kit'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['backend/**/index.js']
    },
    testTimeout: 10000
  }
});
```

**Verification Checklist:**
- [ ] `vitest.config.ts` exists
- [ ] `vitest` in devDependencies
- [ ] `pnpm test` runs without configuration errors
- [ ] Tests discover files in `tests/` and `backend/`

**Testing Instructions:**
- Run `pnpm install` to install Vitest
- Run `pnpm test` to verify test discovery
- Tests may fail due to Jest-specific syntax (addressed in Phase-2)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(test): add Vitest configuration

- Install vitest and coverage plugin
- Configure test discovery paths
- Set up code coverage reporting
```

---

### Task 12: Update .gitignore

**Goal:** Update root .gitignore for monorepo structure.

**Files to Modify:**
- `.gitignore` - Add new ignore patterns

**Prerequisites:**
- None

**Implementation Steps:**

Add these entries to root `.gitignore`:

```
# Backend deployment
backend/.deploy-config.json
backend/samconfig.toml
backend/.aws-sam/

# Environment
.env
.env.local
.env.*.local

# Coverage
coverage/

# Vitest
vitest.config.ts.timestamp*
```

**Verification Checklist:**
- [ ] `.gitignore` includes backend deploy artifacts
- [ ] `.gitignore` includes environment files
- [ ] `git status` doesn't show ignored files

**Testing Instructions:**
- Create a test file matching ignore pattern
- Run `git status` to verify it's not tracked

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore: update .gitignore for monorepo structure

- Add backend deployment artifacts
- Add environment file patterns
- Add coverage and Vitest artifacts
```

---

### Task 13: Delete Obsolete Files

**Goal:** Remove files that are no longer needed after the migration.

**Files to Delete:**
- `.kiro/` directory
- `README.zh.md`
- Individual `jest.config.js` from Lambda directories (if not already removed in Task 7)

**Prerequisites:**
- All move tasks complete (Tasks 2-7)

**Implementation Steps:**
- Use `git rm -rf .kiro` to remove the directory
- Use `git rm README.zh.md` to remove Chinese README
- Verify no other obsolete files remain
- Do NOT delete Python Lambdas yet (addressed in Phase-2)

**Verification Checklist:**
- [ ] `.kiro/` directory no longer exists
- [ ] `README.zh.md` no longer exists
- [ ] No orphaned config files in backend Lambda directories

**Testing Instructions:**
- Run `ls -la` to verify deletions
- Run `git status` to see staged deletions

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore: remove obsolete files

- Delete .kiro/ external tool config
- Delete README.zh.md (unmaintained)
```

---

## Phase Verification

After completing all tasks, verify the phase is complete:

### Directory Structure Check

Run `tree -L 2 -d` and verify output matches:

```
.
├── backend
│   ├── activity-aggregator
│   ├── comments-api
│   ├── download-presigned-url-lambda
│   ├── infra
│   ├── media-upload-lambda
│   ├── messages-api
│   ├── notification-processor
│   ├── pdf-download-lambda
│   ├── profile-api
│   ├── reactions-api
│   └── scripts
├── docs
│   ├── developer
│   ├── plans
│   └── user-guide
├── frontend
│   ├── lib
│   └── routes
└── tests
    ├── e2e
    ├── integration
    ├── load
    └── unit
```

### Functional Checks

- [ ] `pnpm install` completes without errors
- [ ] `pnpm dev` starts SvelteKit dev server
- [ ] `pnpm check` passes TypeScript checks
- [ ] `pnpm lint` runs ESLint
- [ ] `pnpm test` runs Vitest (tests may fail, that's okay)
- [ ] `cd backend && sam validate` passes
- [ ] `node backend/scripts/deploy.js` prompts for config

### Git Status

- [ ] All changes committed
- [ ] No untracked files except ignored patterns
- [ ] Working tree clean

---

## Known Limitations

- Tests may fail due to Jest-specific imports (fixed in Phase-2)
- Python Lambdas not yet ported (Phase-2)
- CI workflow not yet created (Phase-3)
- Some deployment scripts in `backend/scripts/` reference old paths (will be cleaned in Phase-2)

---

## Review Feedback (Iteration 1)

### Task 2 & Task 3: Directory Structure Deviation

> **Consider:** Looking at the plan's target architecture diagram, Lambda functions should be at `backend/comments-api/`, not `backend/lambdas/comments-api/`. Does the current structure match what was specified?
>
> **Think about:** The plan explicitly states "Move `lambdas/comments-api/` → `backend/comments-api/`" (flat structure). Why was an extra `lambdas/` subdirectory created?
>
> **Reflect:** The SAM template at `backend/template.yaml:58` references `CodeUri: lambdas/comments-api/`. If Lambdas were flat at `backend/comments-api/`, what would the CodeUri be?

### Task 3: Missing backend/infra/

> **Consider:** The plan specifies "Move `aws-infrastructure/*.yaml` → `backend/infra/`" and "Move `cloudformation/*.yaml` → `backend/infra/`". Running `ls backend/infra/` returns "does not exist". Where did the 12 CloudFormation YAML files go?
>
> **Think about:** The commit message "consolidate Lambda structure and remove old infra" says files were "replaced by SAM template". But the plan says to **consolidate** infrastructure files, not delete them. Are these files needed for non-SAM deployments (Cognito, DynamoDB tables, monitoring)?
>
> **Reflect:** If someone needs to deploy DynamoDB tables or Cognito user pools, where would they find those templates now?

### Task 11: Vitest Configuration - Exclude Pattern

> **Consider:** Running `pnpm test` shows tests from `backend/lambdas/comments-api/node_modules/` being scanned. The vitest.config.ts excludes `node_modules` but not nested ones. How would you exclude `**/node_modules/**`?
>
> **Think about:** The test output shows "0 tests" for unit tests but the error is "Cannot find module 'aws-sdk-client-mock'". What happens when a test file fails to load?

### Missing Root Dependencies

> **Consider:** Unit tests require `aws-sdk-client-mock` and `@aws-sdk/lib-dynamodb`. These are in Lambda's `package.json` but unit tests run from root. Should testing dependencies be added to root `package.json` devDependencies?
>
> **Reflect:** Run `grep -r "aws-sdk-client-mock" package.json` - is it in root devDependencies?

### Verification Commands to Run

After addressing feedback, verify with:
```bash
# Directory structure matches plan
ls backend/  # Should show comments-api/, messages-api/, infra/, scripts/

# Infrastructure files exist
ls backend/infra/*.yaml | wc -l  # Should be 12

# Tests load and run
pnpm test  # Unit tests should show actual test counts, not "0 test"
```
