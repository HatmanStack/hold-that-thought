# Phase 2: Code Cleanup & Lambda Ports

**Estimated Tokens:** ~40,000

This phase ports the Python Lambdas to Node.js, strips development noise from the codebase, migrates tests from Jest to Vitest syntax, and consolidates documentation.

---

## Phase Goal

Clean and standardize the codebase by:
- Porting activity-aggregator and notification-processor from Python to Node.js
- Stripping all comments, docstrings, console.logs, and debugger statements
- Migrating test files from Jest to Vitest
- Consolidating documentation into docs/
- Updating old deployment scripts for new structure

**Success Criteria:**
- All Lambdas are Node.js (no Python)
- No inline comments or console.logs in production code
- All tests pass with Vitest
- Documentation is consolidated and accurate

---

## Prerequisites

- Phase-1 complete (directory structure migrated)
- All Phase-1 tests passing (or at least discoverable by Vitest)
- SAM template created and validated

---

## Tasks

### Task 1: Port activity-aggregator to Node.js

**Goal:** Rewrite the Python activity-aggregator Lambda in Node.js with equivalent functionality.

**Files to Create:**
- `backend/lambdas/activity-aggregator/index.js` - Node.js handler
- `backend/lambdas/activity-aggregator/package.json` - Dependencies
- `backend/lambdas/activity-aggregator/index.test.js` - Unit tests

**Files to Delete:**
- `backend/lambdas/activity-aggregator/index.py`
- `backend/lambdas/activity-aggregator/requirements.txt`
- `backend/lambdas/activity-aggregator/test_handler.py`

**Prerequisites:**
- Phase-1 complete
- Review Python implementation at `backend/lambdas/activity-aggregator/index.py`

**Implementation Steps:**

The Python Lambda processes DynamoDB Stream events to update user activity stats. Port this to Node.js:

**Functional Requirements:**
- Process DynamoDB Stream INSERT events
- Extract table name from event source ARN
- For comments: increment `commentCount` and update `lastActive`
- For messages: update `lastActive` for sender
- For reactions: update `lastActive` for user
- Use atomic DynamoDB `UpdateExpression` operations
- Continue processing remaining records if one fails

**Structure:**
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;

exports.handler = async (event) => {
  // Process each record
  // Extract table name from eventSourceARN
  // Route to appropriate handler based on table name
  // Return success response
};

async function incrementCommentCount(userId) {
  // ADD commentCount :inc
}

async function updateLastActive(userId) {
  // SET lastActive = :now
}
```

**package.json:**
```json
{
  "name": "activity-aggregator",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.700.0",
    "@aws-sdk/lib-dynamodb": "^3.700.0"
  }
}
```

**Verification Checklist:**
- [ ] `backend/lambdas/activity-aggregator/index.js` exists
- [ ] `backend/lambdas/activity-aggregator/package.json` exists
- [ ] No Python files in `backend/lambdas/activity-aggregator/`
- [ ] `npm install` in directory succeeds
- [ ] Unit tests pass

**Testing Instructions:**
- Create `index.test.js` with tests for:
  - Processing INSERT events for comments table
  - Processing INSERT events for messages table
  - Processing INSERT events for reactions table
  - Error handling for individual record failures
  - Table name extraction from ARN
- Mock DynamoDBDocumentClient using `aws-sdk-client-mock`
- Run `pnpm test backend/lambdas/activity-aggregator`

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): port activity-aggregator to Node.js

- Rewrite Python Lambda in JavaScript
- Maintain DynamoDB Stream processing logic
- Add unit tests with mocked AWS SDK
- Remove Python files
```

---

### Task 2: Port notification-processor to Node.js

**Goal:** Rewrite the Python notification-processor Lambda in Node.js with equivalent functionality.

**Files to Create:**
- `backend/lambdas/notification-processor/index.js` - Node.js handler
- `backend/lambdas/notification-processor/package.json` - Dependencies
- `backend/lambdas/notification-processor/index.test.js` - Unit tests

**Files to Delete:**
- `backend/lambdas/notification-processor/index.py`
- `backend/lambdas/notification-processor/requirements.txt`
- `backend/lambdas/notification-processor/test_handler.py`
- `backend/lambdas/notification-processor/templates/` (if exists)

**Prerequisites:**
- Phase-1 complete
- Review Python implementation at `backend/lambdas/notification-processor/index.py`

**Implementation Steps:**

The Python Lambda processes DynamoDB Stream events to send email notifications. Port to Node.js:

**Functional Requirements:**
- Process DynamoDB Stream INSERT events
- Extract table name from event source ARN
- For comments: log new comment info (production email logic stubbed)
- For reactions: log new reaction info
- For messages: log new message info
- Include `send_email` function using SES (stubbed in current implementation)
- Include debouncing check function (stubbed)
- Continue processing remaining records if one fails

**Structure:**
```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@holdthatthought.family';
const BASE_URL = process.env.BASE_URL || 'https://holdthatthought.family';

exports.handler = async (event) => {
  // Process each record
  // Extract table name from eventSourceARN
  // Route to appropriate notification handler
  // Return success response
};

function processCommentNotification(newImage) {
  // Extract comment data, log for now
}

function processReactionNotification(newImage) {
  // Extract reaction data, log for now
}

function processMessageNotification(newImage) {
  // Extract message data, log for now
}

async function sendEmail(toEmail, subject, bodyHtml) {
  // SES send email implementation
}
```

**package.json:**
```json
{
  "name": "notification-processor",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.700.0",
    "@aws-sdk/lib-dynamodb": "^3.700.0",
    "@aws-sdk/client-ses": "^3.700.0"
  }
}
```

**Verification Checklist:**
- [ ] `backend/lambdas/notification-processor/index.js` exists
- [ ] `backend/lambdas/notification-processor/package.json` exists
- [ ] No Python files in `backend/lambdas/notification-processor/`
- [ ] `npm install` in directory succeeds
- [ ] Unit tests pass

**Testing Instructions:**
- Create `index.test.js` with tests for:
  - Processing INSERT events for comments
  - Processing INSERT events for reactions
  - Processing INSERT events for messages
  - Email sending function (mocked)
  - Error handling for individual record failures
- Mock SESClient using `aws-sdk-client-mock`
- Run `pnpm test backend/lambdas/notification-processor`

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): port notification-processor to Node.js

- Rewrite Python Lambda in JavaScript
- Maintain DynamoDB Stream processing logic
- Add SES email sending function
- Add unit tests with mocked AWS SDK
- Remove Python files
```

---

### Task 3: Update SAM Template for Ported Lambdas

**Goal:** Update the SAM template to use Node.js for the ported Lambdas.

**Files to Modify:**
- `backend/template.yaml` - Update runtime and handlers

**Prerequisites:**
- Tasks 1 and 2 complete

**Implementation Steps:**

Update the ActivityAggregatorFunction and NotificationProcessorFunction resources:

- Change Runtime from `python3.11` to `nodejs20.x` (should already be using Globals)
- Update Handler from `index.lambda_handler` to `index.handler`
- Verify CodeUri points to correct directory
- Add any additional environment variables needed (SES_FROM_EMAIL, BASE_URL)
- Add DynamoDB Stream event sources if not already present

**Verification Checklist:**
- [ ] `sam validate` passes
- [ ] `sam build` succeeds
- [ ] No Python runtime references in template
- [ ] Both ported functions have correct Handler

**Testing Instructions:**
- Run `cd backend && sam validate`
- Run `sam build` to verify all functions build
- Check `.aws-sam/build/` directory contains JavaScript files for ported Lambdas

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(infra): update SAM template for Node.js Lambdas

- Update ported Lambda handlers to index.handler
- Verify all functions use nodejs20.x runtime
- Add notification processor environment variables
```

---

### Task 4: Migrate Tests from Jest to Vitest

**Goal:** Update all test files to use Vitest-compatible syntax.

**Files to Modify:**
After Phase-1 Task 7, the test structure is:
- `tests/unit/comments-handler.test.js` - Lambda unit tests (moved from backend/)
- `tests/unit/messages-handler.test.js` - Lambda unit tests (moved from backend/)
- `tests/unit/profile-handler.test.js` - Lambda unit tests (moved from backend/)
- `tests/unit/profile-security.test.js` - Lambda unit tests (moved from backend/)
- `tests/unit/reactions-handler.test.js` - Lambda unit tests (moved from backend/)
- `tests/integration/comments.test.js` - Live API tests (unchanged)
- `tests/integration/messages.test.js` - Live API tests (unchanged)
- `tests/integration/profile.test.js` - Live API tests (unchanged)
- `tests/integration/reactions.test.js` - Live API tests (unchanged)
- `tests/integration/setup.js` - Test helpers (unchanged)
- Any colocated `.test.js` files in `backend/`

**Prerequisites:**
- Phase-1 Task 11 complete (Vitest config exists)
- Phase-1 Task 7 complete (tests organized into tests/unit/)

**Implementation Steps:**

Jest and Vitest have nearly identical APIs, but some changes are needed:

1. **Remove Jest globals** - Vitest uses same globals when `globals: true` in config
2. **Update imports** - If any test imports from `jest`, change to `vitest`
3. **Update mock syntax** (if needed):
   - Jest: `jest.fn()` → Vitest: `vi.fn()`
   - Jest: `jest.mock()` → Vitest: `vi.mock()`
   - Jest: `jest.spyOn()` → Vitest: `vi.spyOn()`
4. **Update matchers** - Most Jest matchers work in Vitest
5. **Add vitest imports** - If using `vi` object, add `import { vi } from 'vitest'`

For existing tests using `aws-sdk-client-mock`, no changes needed - this library works with both Jest and Vitest.

**Import paths** should already be updated in Phase-1 Task 7:
```javascript
// tests/unit/comments-handler.test.js
const { handler } = require('../../backend/comments-api/index');
```

**Verification Checklist:**
- [ ] `pnpm test` runs without import errors
- [ ] All test files discovered by Vitest
- [ ] Tests use correct import paths to backend handlers
- [ ] No Jest-specific imports remain

**Testing Instructions:**
- Run `pnpm test` to execute all tests
- Check for any syntax errors or import failures
- Verify test count matches expected

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(tests): migrate tests from Jest to Vitest

- Update jest.fn() to vi.fn() where needed
- Verify aws-sdk-client-mock compatibility
- Ensure all test files discovered
```

---

### Task 5: Strip Comments from Lambda Code

**Goal:** Remove all comments, JSDoc, and docstrings from Lambda handler files.

**Files to Modify:**
- `backend/comments-api/index.js`
- `backend/messages-api/index.js`
- `backend/profile-api/index.js`
- `backend/reactions-api/index.js`
- `backend/media-upload-lambda/index.js`
- `backend/pdf-download-lambda/index.js`
- `backend/download-presigned-url-lambda/index.js`
- `backend/lambdas/activity-aggregator/index.js`
- `backend/lambdas/notification-processor/index.js`

**Prerequisites:**
- Tasks 1 and 2 complete (ported Lambdas exist)

**Implementation Steps:**

For each file, remove:
- Single-line comments (`// ...`)
- Multi-line comments (`/* ... */`)
- JSDoc blocks (`/** ... */`)
- Any `TODO`, `FIXME`, `NOTE` comments

Keep:
- Code structure and logic intact
- Blank lines between logical sections (for readability)

Use programmatic approach or manual review. Suggested patterns to remove:
- Lines starting with `//` (after trimming whitespace)
- Lines containing only `/*`, `*/`, or `*` (JSDoc continuation)
- Complete `/** ... */` blocks

**Verification Checklist:**
- [ ] No comment lines in any Lambda index.js
- [ ] Code functionality unchanged
- [ ] All tests still pass
- [ ] `sam build` still succeeds

**Testing Instructions:**
- Run `pnpm test` to verify functionality preserved
- Run `grep -r "^[[:space:]]*\/\/" backend/*/index.js` should return empty
- Run `grep -r "\/\*" backend/*/index.js` should return empty

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): strip comments from Lambda handlers

- Remove inline comments
- Remove JSDoc blocks
- Remove TODO/FIXME markers
- Preserve code functionality
```

---

### Task 6: Strip console.log and debugger Statements

**Goal:** Remove all development logging and debugging statements from Lambda code.

**Files to Modify:**
- All `backend/*/index.js` files
- `backend/scripts/*.js` files (keep essential output)

**Prerequisites:**
- Task 5 complete

**Implementation Steps:**

Remove from Lambda handlers:
- `console.log(...)` statements
- `console.debug(...)` statements
- `console.info(...)` statements
- `console.warn(...)` (unless critical error path)
- `debugger` statements
- `print(...)` if any remain from Python ports

Keep:
- `console.error(...)` for critical error logging
- Structured logging that will be used in production

For deployment scripts (`backend/scripts/*.js`):
- Keep user-facing output (prompts, status messages)
- Remove verbose debug logging

**Verification Checklist:**
- [ ] No `console.log` in Lambda handlers
- [ ] No `debugger` statements anywhere
- [ ] `console.error` used only for actual errors
- [ ] All tests still pass

**Testing Instructions:**
- Run `grep -r "console.log" backend/*/index.js` should return empty
- Run `grep -r "debugger" backend/` should return empty
- Run `pnpm test` to verify functionality

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): remove console.log and debugger statements

- Strip development logging
- Preserve console.error for critical paths
- Keep user-facing output in scripts
```

---

### Task 7: Remove Commented-Out Code

**Goal:** Remove all commented-out code blocks from the codebase.

**Files to Modify:**
- All `backend/*/index.js` files
- All `frontend/**/*.{js,ts,svelte}` files

**Prerequisites:**
- Tasks 5 and 6 complete

**Implementation Steps:**

Search for and remove:
- Commented-out function definitions
- Commented-out import statements
- Commented-out variable declarations
- Commented-out conditional blocks
- Code preceded by comments like "// Old implementation:", "// Disabled:", etc.

Do NOT remove:
- License headers (keep if present)
- Configuration comments in config files (these are intentional)

**Verification Checklist:**
- [ ] No large blocks of commented-out code remain
- [ ] Code compiles/builds successfully
- [ ] All tests pass

**Testing Instructions:**
- Manual review of files for commented code blocks
- Run `pnpm build` to verify frontend still builds
- Run `pnpm test` to verify tests pass

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor: remove commented-out code

- Delete dead code blocks
- Clean up disabled features
- Preserve only active code
```

---

### Task 8: Update Deployment Scripts for New Structure

**Goal:** Update scripts in `backend/scripts/` to work with the new directory structure.

**Files to Modify:**
- `backend/scripts/deploy-all-infrastructure.sh`
- `backend/scripts/deploy-lambdas.sh`
- `backend/scripts/deploy-auth-infrastructure.sh`
- `backend/scripts/deploy-gallery-infrastructure.sh`
- Other scripts that reference old paths

**Prerequisites:**
- Phase-1 complete

**Implementation Steps:**

Update path references in each script:
- `../lambdas/` → `../` (Lambdas are now siblings in backend/)
- `../aws-infrastructure/` → `infra/`
- `../cloudformation/` → `infra/`
- `../scripts/` → `.` (scripts are now in backend/scripts/)

Review each script and update:
- CloudFormation template paths
- Lambda zip/package paths
- Working directory assumptions

Some scripts may become obsolete with SAM deployment. Mark or remove:
- `deploy-lambdas.sh` - Replaced by SAM deploy
- Individual Lambda deploy scripts - Replaced by SAM deploy

Keep scripts that are still useful:
- `add-approved-user.js` - Admin utility
- `backfill-user-profiles.js` - Data migration utility
- `rollback.sh` - Rollback utility (update paths)

**Verification Checklist:**
- [ ] No scripts reference `../lambdas/`
- [ ] No scripts reference `../aws-infrastructure/`
- [ ] Updated scripts run without path errors
- [ ] Obsolete scripts marked or removed

**Testing Instructions:**
- Run `shellcheck backend/scripts/*.sh` for syntax validation
- Manually verify path references in each script
- Test at least one script that interacts with AWS (dry run)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(scripts): update paths for new structure

- Update CloudFormation template paths
- Update Lambda directory references
- Mark obsolete scripts for removal
```

---

### Task 9: Consolidate Documentation

**Goal:** Organize and update documentation in docs/ directory.

**Files to Modify:**
- `docs/README.md` - Create main documentation index
- Move Lambda READMEs content to docs/
- Update `README.md` (root) - Short overview with link to docs

**Files to Delete:**
- `backend/*/README.md` - After consolidating content

**Prerequisites:**
- All code tasks complete

**Implementation Steps:**

**Create docs/README.md** (main documentation hub):
- Overview of the project
- Architecture diagram (text-based)
- Links to:
  - Developer documentation (`docs/developer/`)
  - User guide (`docs/user-guide/`)
  - API reference
  - Deployment guide

**Update root README.md** following savorswipe pattern:
- Project name and badges
- Brief description (2-3 sentences)
- Structure diagram (4 directories)
- Prerequisites list
- Quick start commands
- Link to full documentation

**Consolidate Lambda READMEs:**
- Review each Lambda's README for unique content
- Move API endpoint documentation to `docs/developer/api-reference.md`
- Delete individual Lambda READMEs

**Verification Checklist:**
- [ ] `docs/README.md` exists with full index
- [ ] Root `README.md` is concise with quick start
- [ ] No stale path references in documentation
- [ ] All internal links work

**Testing Instructions:**
- Manually verify all links in documentation
- Check that code examples in docs match actual code
- Verify quick start commands work

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

docs: consolidate and update documentation

- Create docs/README.md as main index
- Update root README with quick start
- Consolidate Lambda documentation
- Fix stale path references
```

---

### Task 10: Create Migration Bash Script

**Goal:** Create a bash script that documents all migration steps for reproducibility.

**Files to Create:**
- `docs/migration-script.sh` - Documented migration commands

**Prerequisites:**
- All previous tasks complete

**Implementation Steps:**

Create a bash script that contains all the commands used to perform the migration. This serves as documentation and can be used for similar future migrations.

Script should include sections for:
1. Directory creation
2. File moves (git mv commands)
3. File deletions
4. Verification commands

Format:
```bash
#!/bin/bash
# Hold That Thought - Monorepo Migration Script
# This script documents the commands used to restructure the repository.
# It is provided for documentation purposes and should not be re-run.

set -e

echo "=== Phase 1: Directory Structure ==="

# Create backend directories
mkdir -p backend/infra
mkdir -p backend/scripts

# Move Lambda functions
git mv lambdas/comments-api backend/
git mv lambdas/messages-api backend/
# ... etc

echo "=== Phase 1 Complete ==="

echo "=== Phase 2: Code Cleanup ==="
# Document manual steps taken
# - Ported activity-aggregator to Node.js
# - Ported notification-processor to Node.js
# - Stripped comments from all Lambda handlers

echo "=== Migration Complete ==="
```

**Verification Checklist:**
- [ ] Script is syntactically valid (`bash -n docs/migration-script.sh`)
- [ ] All migration commands documented
- [ ] Comments explain purpose of each section
- [ ] Script has execute permissions

**Testing Instructions:**
- Run `bash -n docs/migration-script.sh` to validate syntax
- Manual review for completeness

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

docs: add migration script for reproducibility

- Document all directory restructuring commands
- Document all file move operations
- Include verification commands
```

---

## Phase Verification

After completing all tasks, verify the phase is complete:

### Code Quality Checks

```bash
# No Python files in Lambda directories
find backend -name "*.py" -type f
# Should return empty

# No comments in Lambda handlers
grep -r "^[[:space:]]*\/\/" backend/*/index.js
# Should return empty

# No console.log in handlers
grep -r "console.log" backend/*/index.js
# Should return empty
```

### Test Suite

```bash
# All tests pass
pnpm test

# Coverage report generated
# Check coverage/ directory
```

### Build Verification

```bash
# SAM build succeeds
cd backend && sam build

# Frontend build succeeds
pnpm build
```

### Documentation Check

- [ ] Root README.md is concise and accurate
- [ ] docs/README.md has full index
- [ ] No broken links in documentation
- [ ] API reference is complete

---

## Cleanup List

Files deleted in this phase:

| File | Reason |
|------|--------|
| `backend/lambdas/activity-aggregator/index.py` | Replaced by Node.js |
| `backend/lambdas/activity-aggregator/requirements.txt` | No longer needed |
| `backend/lambdas/activity-aggregator/test_handler.py` | Replaced by JS tests |
| `backend/lambdas/notification-processor/index.py` | Replaced by Node.js |
| `backend/lambdas/notification-processor/requirements.txt` | No longer needed |
| `backend/lambdas/notification-processor/test_handler.py` | Replaced by JS tests |
| `backend/lambdas/notification-processor/templates/` | Moved to docs or deleted |
| `backend/*/README.md` | Content consolidated to docs/ |

---

## Known Limitations

- Notification processor email sending is still stubbed
- Some deployment scripts may need further testing with live AWS
- Comment stripping is manual; could miss edge cases

---

## Review Feedback (Iteration 1)

### Critical: Unit Tests Failing (12 failures out of 52 tests)

> **Consider:** The unit test file `tests/unit/comments-handler.test.js` is trying to mock AWS SDK using `aws-sdk-client-mock`, but tests are returning 500 errors with "tableName null". Are the environment variables being set _before_ the handler is required?

> **Think about:** In the test file line 8-9, `process.env.COMMENTS_TABLE` and `process.env.USER_PROFILES_TABLE` are set, but the handler at line 1 requires `../../backend/lambdas/comments-api/index`. Does the handler read environment variables at module load time or at runtime?

> **Reflect:** Looking at the error messages, the actual AWS DynamoDB client is being called with `null` tableName. Is the mock properly intercepting the DynamoDB client? Are you requiring the module at the right time relative to when mocks and env vars are set?

### Critical: profile-security.test.js Has 0 Tests Discovered

> **Consider:** The test file `tests/unit/profile-security.test.js` reports "(0 test)" despite having many test cases defined. Looking at lines 6-7 of that file, you're using `jest.mock()` and `jest.fn()`. Have these been updated to Vitest equivalents?

> **Think about:** Task 4 specified: "Jest: `jest.fn()` → Vitest: `vi.fn()`" and "Jest: `jest.mock()` → Vitest: `vi.mock()`". Have all `jest.*` references been converted? You can verify with: `grep -r "jest\." tests/`

> **Reflect:** When Vitest encounters `jest.mock()` without Jest being installed, does it fail silently or throw an error? What does the test output show for this file?

### Task 2: notification-processor templates directory not deleted

> **Consider:** The plan at line 151 specifies deleting `backend/lambdas/notification-processor/templates/` (if exists). Looking at the directory listing, `backend/lambdas/notification-processor/templates/` still exists with 4 HTML/TXT files. Was this intentional, or should the templates be removed?

> **Think about:** The notification processor currently has stubbed email functionality. Are these templates being used? Should they be preserved for future email implementation, or deleted per the plan?

### Task 6: console.error Statements Remain

> **Consider:** Both ported Lambda handlers (`activity-aggregator/index.js:15` and `notification-processor/index.js:20,73`) still contain `console.error()` calls. The plan states: "Keep `console.error(...)` for critical error logging". Is this intentional and acceptable for production CloudWatch logging?

### Task 8: Deployment Scripts Path Issue

> **Consider:** Looking at `deploy-lambdas.sh:22` and `deploy-production.sh:65`, the scripts reference `lambdas/` directory (e.g., `lambdas/profile-api`). However, the Phase-2 plan at line 549-553 suggests paths like `../lambdas/` → `../`. Is the current path structure (`backend/lambdas/`) correct for these scripts which run from `backend/scripts/`?

> **Reflect:** Run through the script logic: if you `cd backend/scripts && ./deploy-lambdas.sh`, would `lambdas/profile-api` resolve correctly? The script does `cd "$lambda_dir"` - from which working directory?

### Build Failure

> **Consider:** The `pnpm build` command fails with `Error: ENOENT: no such file or directory, scandir 'urara'`. This appears to be a frontend/Urara configuration issue, not related to Phase 2 backend changes. Has the frontend directory structure been affected by Phase 1 migrations?

> **Think about:** Looking at the project structure, there's a `frontend/` directory. Has the Urara framework been properly configured to look for content in the right location after the Phase 1 restructuring?

### Verification Status

| Check | Status | Notes |
|-------|--------|-------|
| No Python files in Lambda dirs | ✓ PASS | Only Python in node_modules (flatted package) |
| No comments in handlers | ✓ PASS | Grep returns empty |
| No console.log in handlers | ✓ PASS | Only console.error remains (intentional) |
| SAM template valid | ✓ PASS | `sam validate` passes |
| All tests pass | ✗ FAIL | 12 unit tests failing, profile-security has 0 tests |
| Frontend build | ✗ FAIL | urara directory not found |
| Lambda ports complete | ✓ PASS | Node.js handlers exist with tests |
| Documentation consolidated | ✓ PASS | docs/README.md exists |
| Migration script | ✓ PASS | docs/migration-script.sh valid |

**Action Required:** Fix the test issues before this phase can be approved. The Jest→Vitest migration in Task 4 was not fully completed for `profile-security.test.js`, and the comments-handler tests have mock timing issues.
