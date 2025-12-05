# Phase 0: Foundation

## Phase Goal

Establish the architectural foundation, design decisions, deployment infrastructure, and testing patterns that all subsequent phases will follow. This phase produces no user-visible features but creates the scaffolding for reliable, testable implementation.

**Success Criteria:**
- All ADRs documented and rationale clear
- Deploy script updated to prompt for letters S3 source
- Test infrastructure supports mocked AWS services
- Shared utilities and patterns defined

**Estimated Tokens:** ~15,000

## Architecture Decision Records (ADRs)

### ADR-001: Single S3 Bucket Architecture

**Context:** Currently using `hold-that-thought-bucket` created ad-hoc, with separate buckets for media and profile photos created during deployment.

**Decision:** Create a single bucket `hold-that-thought-archive` that houses:
- `/letters/` - Renamed markdown + PDF pairs (date-based naming)
- `/media/pictures/` - User-uploaded pictures
- `/media/videos/` - User-uploaded videos
- `/media/documents/` - User-uploaded documents (family history PDFs, etc.)
- `/lambdas/` - SAM deployment artifacts

**Rationale:**
- Simplifies CORS configuration (one bucket)
- Reduces S3 costs (single bucket lifecycle policies)
- Clear separation via prefixes
- Easier backup/disaster recovery

**Consequences:**
- Must update all S3 references in backend code
- Deploy script creates this bucket if not exists
- Old bucket (`hold-that-thought-bucket`) retired after migration

---

### ADR-002: Date-Based Naming Convention

**Context:** Current naming uses folder structure with descriptive titles (e.g., `urara/Family Update Letter February 2016/`). PDFs have inconsistent names derived from source processing.

**Decision:** Rename to date-based format extracted from letter content:
- Primary: `YYYY-MM-DD.md` and `YYYY-MM-DD.pdf`
- Collision handling: `YYYY-MM-DD-{slug}.md` where slug is first 3 words of title, slugified
- Location: `s3://hold-that-thought-archive/letters/`

**Date Extraction Strategy:**
1. Parse first line of markdown body (after frontmatter) for date patterns
2. Common patterns: "Feb. 10. 2016", "February 10, 2016", "2/10/2016"
3. Fallback: Use frontmatter `date` field if body parsing fails
4. Manual review: Log any files where date extraction fails

**Rationale:**
- Enables chronological sorting without parsing content
- Simplifies DynamoDB key design (date as sort key)
- Human-readable file names
- Collision handling preserves uniqueness

**Consequences:**
- Migration script must parse dates from ~180 letters
- Some letters may require manual date assignment
- Original folder names preserved in DynamoDB metadata

---

### ADR-003: DynamoDB Version History Pattern

**Context:** Users need to edit letter content while maintaining access to original and previous versions.

**Decision:** Store versions using the existing single-table design:

```
Letter Entity:
  PK: LETTER#{date}           (e.g., LETTER#2016-02-10)
  SK: CURRENT
  Attributes: content, title, originalTitle, pdfKey, createdAt, updatedAt, lastEditedBy

Version Entity:
  PK: LETTER#{date}
  SK: VERSION#{timestamp}     (e.g., VERSION#2025-01-15T10:30:00.000Z)
  Attributes: content, editedBy, editedAt, versionNumber
```

**Query Patterns:**
- Get current letter: `PK = LETTER#{date}, SK = CURRENT`
- List all versions: `PK = LETTER#{date}, SK begins_with VERSION#`
- List all letters (chronologically): Query GSI1 with `GSI1PK = 'LETTERS'`, sorted by `GSI1SK = {date}`
- Revert: Copy version content to CURRENT, create new VERSION entry

**GSI1 Usage (Already Exists):**
The DynamoDB table already has GSI1 (GSI1PK + GSI1SK) defined in the SAM template. Letters will use:
- `GSI1PK = 'LETTERS'` (constant for all letters)
- `GSI1SK = {date}` (e.g., '2016-02-10') for chronological sorting

**Rationale:**
- Fits existing single-table design
- Efficient queries (single partition for letter + all versions)
- Uses existing GSI1 for chronological listing
- TTL not applied to versions (permanent history)

**Consequences:**
- Version count unbounded (acceptable for family letters use case)
- Revert creates new version (audit trail preserved)

---

### ADR-004: Hybrid Static/Dynamic Frontend

**Context:** Current architecture uses static site generation via urara.js, copying markdown to SvelteKit routes.

**Decision:** Hybrid approach:
- **Static:** Letter index page (list of letters with dates/titles)
- **Dynamic:** Individual letter content fetched from API on page load
- **Editor:** Authenticated users see edit button, opens split-view editor

**Implementation:**
1. Remove urara.js file watching/copying for letters
2. Keep urara.js for any non-letter content (if applicable)
3. Create `/letters` route with dynamic `[date]` parameter
4. Fetch letter content from new API endpoint
5. Cache responses client-side for performance

**Rationale:**
- Enables real-time content updates without rebuild
- Maintains fast initial page load (static shell)
- Edit capability without redeployment
- Progressive enhancement (works without JS for index)

**Consequences:**
- Letters no longer available as static HTML
- Requires API call for each letter view
- SEO impact mitigated by static index with metadata

---

### ADR-005: Frontmatter Elimination

**Context:** Current markdown files have YAML frontmatter (title, date). The `fff-flavored-frontmatter` and `gray-matter` packages process this. After migration, all metadata lives in DynamoDB.

**Decision:** Remove frontmatter from:
1. Markdown files in S3 (strip during migration)
2. Frontend code (remove gray-matter dependency for letters)
3. mdsvex processing (keep for any remaining non-letter markdown)

**What to Remove:**
- `gray-matter` usage for letter processing
- `fff-flavored-frontmatter` usage for letter processing
- `remarkFFF` plugin application to letters
- Frontmatter-dependent logic in `posts.ts`

**What to Keep:**
- mdsvex configuration (may be used elsewhere)
- Any non-letter markdown processing

**Rationale:**
- Single source of truth (DynamoDB)
- Simpler markdown files (pure content)
- Removes parsing complexity from frontend

**Consequences:**
- Migration script strips frontmatter
- Frontend letter fetching gets metadata from API, not file
- Build process simplified

---

## Deployment Script Specification

### Current State
The deploy script (`backend/scripts/deploy.sh`) prompts for:
- AWS Region
- Stack Name
- App Domain
- Allowed Origins
- Google OAuth credentials
- DynamoDB Table Name
- SES From Email
- Media Bucket
- Profile Photos Bucket

### Required Changes

**New Prompts to Add:**
1. **Archive Bucket Name** (replaces Media Bucket)
   - Default: `hold-that-thought-archive`
   - Stores: letters, media, lambdas

2. **Letters Source S3 URI** (new)
   - Prompt: "Letters Source S3 URI (for initial population)"
   - Example: `s3://hold-that-thought-bucket/urara/`
   - Only prompted on first deploy or when flag passed
   - Saved to `.env.deploy`

**Prompts to Remove:**
- Media Bucket (replaced by Archive Bucket)
- Profile Photos Bucket (consolidated into Archive Bucket)

**New Deployment Steps:**
1. Create archive bucket if not exists
2. Configure CORS on archive bucket
3. If letters source provided and DynamoDB table empty:
   - Run migration script (separate Node.js script)
   - Parse markdown files, extract dates, rename
   - Strip frontmatter from markdown
   - Copy to archive bucket `/letters/`
   - Populate DynamoDB with letter metadata
4. Build and deploy SAM stack
5. Update frontend `.env`

### Configuration File Updates

**`.env.deploy` additions:**
```bash
ARCHIVE_BUCKET=hold-that-thought-archive
LETTERS_SOURCE_URI=s3://hold-that-thought-bucket/urara/
LETTERS_MIGRATED=true  # Set after successful migration
```

**`samconfig.toml` changes:**
- Replace `MediaBucket` parameter with `ArchiveBucket`
- Remove `ProfilePhotosBucket` parameter
- Add `ArchiveBucket` to parameter overrides

**`template.yaml` changes:**
- Rename `MediaBucket` parameter to `ArchiveBucket`
- Remove `ProfilePhotosBucket` parameter
- Update all Lambda environment variables
- Update S3 policy references

---

## Testing Strategy

### Unit Test Patterns

**Location:** `tests/unit/`

**Directory Structure Note:** The existing tests use a flat structure (e.g., `tests/unit/comments-handler.test.js`). For migration-specific tests, create a `tests/unit/migration/` subdirectory to keep them organized separately. Handler tests should remain in the flat structure for consistency.

**Mocking Approach:**
```javascript
// Use aws-sdk-client-mock for all AWS service mocks
const { mockClient } = require('aws-sdk-client-mock')
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')
const { S3Client } = require('@aws-sdk/client-s3')

const ddbMock = mockClient(DynamoDBDocumentClient)
const s3Mock = mockClient(S3Client)

beforeEach(() => {
  ddbMock.reset()
  s3Mock.reset()
})
```

**Test File Naming:** `{feature}-handler.test.js`

**Test Structure:**
```javascript
describe('letters API Lambda', () => {
  describe('GET /letters', () => {
    it('should return paginated letters', async () => { ... })
    it('should handle empty results', async () => { ... })
  })

  describe('GET /letters/{date}', () => {
    it('should return letter content', async () => { ... })
    it('should return 404 for non-existent letter', async () => { ... })
  })

  describe('PUT /letters/{date}', () => {
    it('should update letter and create version', async () => { ... })
    it('should require authentication', async () => { ... })
  })
})
```

### Integration Test Patterns

**Location:** `tests/integration/`

**Note:** Integration tests are excluded from CI (`vitest.config.ts` excludes `tests/integration/**`). They require live AWS resources and are run manually during development.

**For CI-compatible "integration" tests:** Use mocked AWS services and test the full request/response cycle through the Lambda handler.

### Migration Script Tests

**Location:** `tests/unit/migration/`

**Test Cases:**
- Date extraction from various formats
- Frontmatter stripping
- Collision detection and slug generation
- S3 copy operations (mocked)
- DynamoDB population (mocked)

---

## Shared Patterns and Conventions

### Key Prefix Extensions

Add to `backend/lambdas/api/utils.js`:

```javascript
const PREFIX = {
  // ... existing prefixes
  LETTER: 'LETTER#',
  VERSION: 'VERSION#',
}

const keys = {
  // ... existing key builders

  // Letter: PK=LETTER#<date>, SK=CURRENT
  letter: (date) => ({
    PK: `${PREFIX.LETTER}${date}`,
    SK: 'CURRENT',
  }),

  // Letter versions: PK=LETTER#<date>, SK=VERSION#<timestamp>
  letterVersion: (date, timestamp) => ({
    PK: `${PREFIX.LETTER}${date}`,
    SK: `${PREFIX.VERSION}${timestamp}`,
  }),

  // Query all versions: PK=LETTER#<date>, SK begins_with VERSION#
  letterVersions: (date) => ({
    PK: `${PREFIX.LETTER}${date}`,
    SKPrefix: PREFIX.VERSION,
  }),
}
```

### Response Format

All letter API responses follow existing patterns:

```javascript
// Success
{
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({ /* data */ })
}

// Error
{
  statusCode: 4xx/5xx,
  headers: { ... },
  body: JSON.stringify({ error: 'Message' })
}
```

### Commit Message Format

```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

type(scope): brief description

- Detail 1
- Detail 2
```

**Types:** feat, fix, refactor, test, docs, chore
**Scopes:** letters, deploy, migration, frontend, backend, api

---

## Prerequisites

- None (this is the foundation phase)

## Tasks

### Task 1: Create Migration Script Infrastructure

**Goal:** Set up the Node.js migration script structure that will transform and migrate letters from the old S3 location to the new archive bucket.

**Files to Create:**
- `backend/scripts/migrate-letters.js` - Main migration script
- `backend/scripts/lib/date-parser.js` - Date extraction utilities
- `backend/scripts/lib/frontmatter-stripper.js` - Frontmatter removal
- `backend/scripts/lib/s3-operations.js` - S3 copy/list utilities

**Prerequisites:**
- AWS SDK v3 installed (already in dependencies)

**Implementation Steps:**
1. Create script directory structure under `backend/scripts/`
2. Implement date parser module with support for common date formats found in letters
3. Implement frontmatter stripper using regex (avoid gray-matter dependency in script)
4. Implement S3 operations module for listing source bucket and copying files
5. Create main migration script that orchestrates the process
6. Add dry-run mode for testing without making changes

**Verification Checklist:**
- [ ] Date parser correctly extracts dates from sample letter formats
- [ ] Frontmatter stripper removes YAML frontmatter while preserving content
- [ ] S3 operations module can list and copy files (tested with mocks)
- [ ] Main script runs in dry-run mode without errors

**Testing Instructions:**
- Create unit tests in `tests/unit/migration/`
- Test date parser with various format strings
- Test frontmatter stripper with sample markdown
- Mock S3 client for operations tests

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): add letter migration script infrastructure

- Add date parser for extracting dates from letter content
- Add frontmatter stripper utility
- Add S3 operations module for bucket migration
- Include dry-run mode for safe testing
```

---

### Task 2: Update Deploy Script for Archive Bucket

**Goal:** Modify the deploy script to use the new single archive bucket and add letters source URI prompt.

**Files to Modify:**
- `backend/scripts/deploy.sh` - Main deploy script

**Prerequisites:**
- Task 1 complete (migration script exists)

**Implementation Steps:**
1. Replace Media Bucket and Profile Photos Bucket prompts with single Archive Bucket prompt
2. Add Letters Source S3 URI prompt (with option to skip if already migrated)
3. Add LETTERS_MIGRATED flag check to `.env.deploy`
4. Update bucket creation logic to create archive bucket with appropriate CORS
5. Add migration step that calls `migrate-letters.js` when appropriate
6. Update `samconfig.toml` generation to use new parameter names
7. Update frontend `.env` generation with new bucket name

**Verification Checklist:**
- [ ] Script prompts for archive bucket name
- [ ] Script prompts for letters source URI on first run
- [ ] Script skips letters prompt if LETTERS_MIGRATED=true
- [ ] CORS configuration applied to archive bucket
- [ ] samconfig.toml generated with correct parameters
- [ ] Frontend .env updated correctly

**Testing Instructions:**
- Run deploy script in test mode (add `--dry-run` flag support)
- Verify prompts appear in correct order
- Verify configuration files generated correctly
- Update `backend/scripts/deploy.test.js` with new prompt tests

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(deploy): update deploy script for archive bucket

- Replace media/profile buckets with single archive bucket
- Add letters source URI prompt for migration
- Add migration step integration
- Update samconfig.toml generation
```

---

### Task 3: Update SAM Template Parameters

**Goal:** Modify the CloudFormation template to use the consolidated archive bucket.

**Files to Modify:**
- `backend/template.yaml` - SAM template

**Prerequisites:**
- Task 2 complete (deploy script updated)

**Implementation Steps:**
1. Rename `MediaBucket` parameter to `ArchiveBucket`
2. Remove `ProfilePhotosBucket` parameter
3. Update ApiFunction environment variables to use ARCHIVE_BUCKET
4. Update S3 policy references to use archive bucket
5. Add comments explaining bucket prefix structure
6. Update Outputs section if needed

**Verification Checklist:**
- [ ] Template validates with `sam validate`
- [ ] Only one bucket parameter exists (ArchiveBucket)
- [ ] Lambda environment variables reference correct bucket
- [ ] IAM policies grant access to archive bucket
- [ ] No references to old bucket parameters remain

**Testing Instructions:**
- Run `sam validate --template backend/template.yaml`
- Run `sam build` to verify template compiles
- Deploy to test stack and verify Lambda has correct env vars

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): consolidate S3 buckets in SAM template

- Rename MediaBucket to ArchiveBucket
- Remove ProfilePhotosBucket parameter
- Update Lambda environment variables
- Update IAM policies for single bucket
```

---

### Task 4: Update Backend Utils for Archive Bucket

**Goal:** Update the shared utilities to reference the archive bucket and add letter key prefixes.

**Files to Modify:**
- `backend/lambdas/api/utils.js` - Shared utilities

**Prerequisites:**
- Task 3 complete (template updated)

**Implementation Steps:**
1. Update BUCKETS object to use single ARCHIVE_BUCKET env var
2. Add helper methods for constructing bucket paths (letters, media, etc.)
3. Add PREFIX entries for LETTER and VERSION
4. Add key builder functions for letters and versions
5. Maintain backward compatibility for existing media operations

**Verification Checklist:**
- [ ] BUCKETS.archive returns correct bucket name from env
- [ ] Path helpers generate correct S3 keys
- [ ] PREFIX.LETTER and PREFIX.VERSION defined
- [ ] Key builders for letters and versions work correctly
- [ ] Existing media operations still function

**Testing Instructions:**
- Update existing unit tests that reference BUCKETS
- Add tests for new letter key builders
- Verify path helper functions

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): add letter prefixes and archive bucket utils

- Update BUCKETS to use archive bucket
- Add path helpers for S3 key construction
- Add LETTER and VERSION prefixes
- Add letter key builder functions
```

---

### Task 5: Update Media Routes for Archive Bucket

**Goal:** Update the media routes to use the archive bucket with appropriate path prefixes.

**Files to Modify:**
- `backend/lambdas/api/routes/media.js` - Media route handlers

**Prerequisites:**
- Task 4 complete (utils updated)

**Implementation Steps:**
1. Update bucket references to use BUCKETS.archive
2. Update path construction to maintain `/media/` prefix in keys
3. Update profile photo operations to use archive bucket with `/profile-photos/` prefix
4. Ensure existing functionality preserved
5. Update any hardcoded bucket references

**Verification Checklist:**
- [ ] Media uploads go to `archive-bucket/media/{category}/`
- [ ] Profile photos go to `archive-bucket/profile-photos/`
- [ ] List operations return correct items
- [ ] Download URLs generated correctly
- [ ] No references to old bucket names

**Testing Instructions:**
- Update media handler tests to mock archive bucket
- Test upload URL generation
- Test list operations
- Test download URL generation

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): update media routes for archive bucket

- Update all bucket references to use archive bucket
- Maintain /media/ prefix for media operations
- Add /profile-photos/ prefix for profile photos
- Preserve existing API behavior
```

---

## Phase Verification

After completing all tasks in Phase 0:

1. **Deploy Script Test:**
   ```bash
   cd backend && ./scripts/deploy.sh --dry-run
   ```
   - Verify new prompts appear
   - Verify configuration files generated correctly

2. **SAM Validation:**
   ```bash
   cd backend && sam validate && sam build
   ```
   - Template should validate without errors
   - Build should complete successfully

3. **Unit Tests:**
   ```bash
   pnpm test -- tests/unit/migration tests/unit/*-handler.test.js
   ```
   - All tests should pass
   - Migration utilities tested

4. **Integration Check:**
   - Deploy to test stack
   - Verify Lambda functions have correct environment variables
   - Verify archive bucket created with CORS

## Known Limitations

- Migration script requires manual verification for date extraction failures
- Old bucket (`hold-that-thought-bucket`) must be manually retired after migration verification
- Profile photos bucket consolidation may require updating existing photo URLs in DynamoDB

## Technical Debt

- Consider adding bucket lifecycle policies for cost optimization
- May want to add CloudFront distribution for archive bucket in future
- Migration script logging could be enhanced for production use
