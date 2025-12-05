# Phase 1: S3 Migration & Data Transformation

## Phase Goal

Execute the data migration from the old S3 bucket structure to the new archive bucket with date-based naming. This phase transforms ~180 letters from folder-based organization with inconsistent naming to a clean, date-based structure suitable for DynamoDB indexing.

**Success Criteria:**
- All letters migrated to `hold-that-thought-archive/letters/`
- Markdown files renamed to date-based convention (e.g., `2016-02-10.md`)
- PDF files paired with markdown (e.g., `2016-02-10.pdf`)
- Frontmatter stripped from all markdown files
- Media files migrated to new bucket with preserved structure
- Migration report generated showing any issues

**Estimated Tokens:** ~35,000

## Prerequisites

- Phase 0 complete (migration script infrastructure exists)
- AWS credentials configured with S3 read/write permissions
- Source bucket accessible: `s3://hold-that-thought-bucket/`
- Archive bucket created: `s3://hold-that-thought-archive/`

## Tasks

### Task 1: Implement Date Parser Module

**Goal:** Create a robust date parser that extracts dates from the various formats found in letter content.

**Files to Modify/Create:**
- `backend/scripts/lib/date-parser.js` - Date extraction logic

**Prerequisites:**
- Phase 0 Task 1 file structure exists

**Implementation Steps:**
1. Analyze sample letters to identify all date formats used:
   - "Feb. 10. 2016" (abbreviated month, periods)
   - "February 10, 2016" (full month name)
   - "2/10/2016" or "02/10/2016" (numeric)
   - "10 February 2016" (European style)
2. Implement regex patterns for each format
3. Create main `extractDate(markdownContent)` function that:
   - Strips frontmatter first
   - Searches first 10 lines of body for date pattern
   - Returns ISO date string (YYYY-MM-DD) or null
4. Handle edge cases:
   - Multiple dates in content (use first)
   - Date ranges (use start date)
   - Malformed dates (return null for manual review)
5. Export validation function to check if date is reasonable (1990-2025)

**Verification Checklist:**
- [x] Parses "Feb. 10. 2016" correctly to "2016-02-10"
- [x] Parses "February 10, 2016" correctly
- [x] Parses "2/10/2016" correctly
- [x] Handles missing dates (returns null)
- [x] Validates year range
- [x] Works with actual letter content samples

**Testing Instructions:**
Create `tests/unit/migration/date-parser.test.js`:
```javascript
describe('date parser', () => {
  it('should parse abbreviated month format', () => {
    const content = '---\ntitle: Test\n---\n\nFeb. 10. 2016\n\nDear Family,'
    expect(extractDate(content)).toBe('2016-02-10')
  })
  // Add tests for all format variations
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): implement date parser for letter content

- Add regex patterns for common date formats
- Extract date from first 10 lines of letter body
- Validate dates within reasonable range
- Return null for unparseable dates
```

---

### Task 2: Implement Frontmatter Stripper

**Goal:** Create a utility that removes YAML frontmatter from markdown files while preserving all content.

**Files to Modify/Create:**
- `backend/scripts/lib/frontmatter-stripper.js` - Frontmatter removal logic

**Prerequisites:**
- None (independent utility)

**Implementation Steps:**
1. Implement regex to detect frontmatter block:
   - Starts with `---` on first line
   - Ends with `---` on its own line
   - May contain any YAML content between
2. Create `stripFrontmatter(markdownContent)` function:
   - Return content unchanged if no frontmatter detected
   - Remove frontmatter block including delimiters
   - Preserve leading newlines after frontmatter for formatting
   - Trim excessive whitespace at start
3. Create `extractFrontmatter(markdownContent)` function:
   - Return parsed frontmatter as object (for metadata extraction during migration)
   - Return empty object if no frontmatter
4. Handle edge cases:
   - Files without frontmatter
   - Malformed frontmatter (missing closing ---)
   - Content that looks like frontmatter but isn't

**Verification Checklist:**
- [x] Removes standard frontmatter correctly
- [x] Preserves content after frontmatter
- [x] Handles files without frontmatter
- [x] Extracts frontmatter fields for metadata
- [x] Handles malformed frontmatter gracefully

**Testing Instructions:**
Create `tests/unit/migration/frontmatter-stripper.test.js`:
```javascript
describe('frontmatter stripper', () => {
  it('should remove frontmatter and preserve content', () => {
    const input = '---\ntitle: "Test"\ndate: 2016-02-10\n---\n\nDear Family,'
    expect(stripFrontmatter(input)).toBe('Dear Family,')
  })

  it('should extract frontmatter fields', () => {
    const input = '---\ntitle: "Test Letter"\n---\n\nContent'
    expect(extractFrontmatter(input)).toEqual({ title: 'Test Letter' })
  })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): implement frontmatter stripper utility

- Strip YAML frontmatter from markdown files
- Extract frontmatter fields for metadata preservation
- Handle edge cases and malformed frontmatter
```

---

### Task 3: Implement S3 Operations Module

**Goal:** Create S3 utility functions for listing source bucket contents and copying files to archive bucket.

**Files to Modify/Create:**
- `backend/scripts/lib/s3-operations.js` - S3 utilities

**Prerequisites:**
- AWS SDK v3 available

**Implementation Steps:**
1. Create S3 client configuration
2. Implement `listLetterFolders(sourceBucket, prefix)`:
   - List all folders under `urara/` prefix
   - Return array of folder names (letter titles)
3. Implement `getLetterFiles(sourceBucket, folderPath)`:
   - Get markdown file (`.md` or `.svelte.md`)
   - Get PDF file (any `.pdf` in folder)
   - Return { markdown: content, pdf: key, folderName }
4. Implement `copyFile(sourceBucket, sourceKey, destBucket, destKey)`:
   - Copy single file between buckets
   - Preserve content type
5. Implement `uploadContent(destBucket, key, content, contentType)`:
   - Upload string content (for modified markdown)
6. Add progress callback support for reporting

**Verification Checklist:**
- [x] Lists all folders in urara/ prefix
- [x] Retrieves markdown content from folders
- [x] Identifies PDF files in folders
- [x] Copies files between buckets preserving metadata
- [x] Uploads modified content correctly
- [x] Handles pagination for large buckets

**Testing Instructions:**
Create `tests/unit/migration/s3-operations.test.js`:
```javascript
const { mockClient } = require('aws-sdk-client-mock')
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3')

const s3Mock = mockClient(S3Client)

describe('s3 operations', () => {
  beforeEach(() => s3Mock.reset())

  it('should list letter folders', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      CommonPrefixes: [
        { Prefix: 'urara/Family Update Letter February 2016/' },
        { Prefix: 'urara/Christmas 2015/' }
      ]
    })
    const folders = await listLetterFolders('bucket', 'urara/')
    expect(folders).toHaveLength(2)
  })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): implement S3 operations module

- Add functions for listing letter folders
- Add functions for retrieving letter files
- Add copy and upload functions
- Support progress callbacks
```

---

### Task 4: Implement Slug Generator for Collisions

**Goal:** Create a utility that generates URL-safe slugs from letter titles for collision handling.

**Files to Modify/Create:**
- `backend/scripts/lib/slug-generator.js` - Slug generation

**Prerequisites:**
- None (independent utility)

**Implementation Steps:**
1. Implement `generateSlug(title, maxWords = 3)`:
   - Take first N words from title
   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove special characters
   - Return slug (e.g., "family-update-letter")
2. Implement `generateUniqueFilename(date, title, existingDates)`:
   - If date not in existingDates, return `{date}.md`
   - If collision, append slug: `{date}-{slug}.md`
   - Handle multiple collisions on same date
3. Track used filenames to prevent duplicates

**Verification Checklist:**
- [x] Generates clean slugs from titles
- [x] Handles special characters in titles
- [x] Detects collisions and appends slug
- [x] Generates unique names for multiple same-date letters
- [x] Works with actual letter titles from S3

**Testing Instructions:**
Create `tests/unit/migration/slug-generator.test.js`:
```javascript
describe('slug generator', () => {
  it('should generate slug from title', () => {
    expect(generateSlug('Family Update Letter February 2016')).toBe('family-update-letter')
  })

  it('should handle collision', () => {
    const existing = new Set(['2016-02-10'])
    const result = generateUniqueFilename('2016-02-10', 'Family Update', existing)
    expect(result).toBe('2016-02-10-family-update.md')
  })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): implement slug generator for filename collisions

- Generate URL-safe slugs from titles
- Handle date collisions with slug suffix
- Track used filenames for uniqueness
```

---

### Task 5: Implement Main Migration Script

**Goal:** Create the orchestrator script that coordinates all migration operations.

**Files to Modify/Create:**
- `backend/scripts/migrate-letters.js` - Main migration script

**Prerequisites:**
- Tasks 1-4 complete (all utility modules)

**Implementation Steps:**
1. Parse command line arguments:
   - `--source-bucket`: Source S3 bucket
   - `--source-prefix`: Source prefix (default: `urara/`)
   - `--dest-bucket`: Destination bucket
   - `--dest-prefix`: Destination prefix (default: `letters/`)
   - `--dry-run`: Don't make changes, just report
   - `--verbose`: Detailed logging
2. Implement main migration flow:
   ```
   for each folder in source:
     - Get markdown and PDF files
     - Extract date from markdown content
     - Strip frontmatter from markdown
     - Generate destination filename
     - Copy/upload files to destination
     - Log result
   ```
3. Generate migration report:
   - Total folders processed
   - Successful migrations
   - Failed date extractions (need manual review)
   - Collisions handled
   - Any errors
4. Output report to JSON file for review
5. Support resume capability (skip already-migrated files)

**Verification Checklist:**
- [x] Parses all command line arguments
- [x] Processes all folders in source bucket
- [x] Extracts dates and generates correct filenames
- [x] Strips frontmatter from markdown
- [x] Copies PDFs alongside markdown
- [x] Generates comprehensive report
- [x] Dry-run mode works correctly
- [x] Resume skips existing files

**Testing Instructions:**
Create `tests/unit/migration/migrate-letters.test.js`:
```javascript
describe('migration script', () => {
  it('should process letter folder correctly', async () => {
    // Mock S3 operations
    // Mock date parser
    // Mock frontmatter stripper
    // Verify correct sequence of operations
  })

  it('should handle date extraction failure gracefully', async () => {
    // Verify letter is flagged for manual review
  })

  it('should generate accurate report', async () => {
    // Verify report contains all expected fields
  })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): implement main letter migration script

- Orchestrate full migration workflow
- Support dry-run and verbose modes
- Generate detailed migration report
- Support resume for interrupted migrations
```

---

### Task 6: Migrate Media Files

**Goal:** Copy existing media files from old bucket to archive bucket with preserved structure.

**Files to Modify/Create:**
- `backend/scripts/migrate-media.js` - Media migration script

**Prerequisites:**
- Task 3 complete (S3 operations module)

**Implementation Steps:**
1. Implement media migration script:
   - Source: `s3://hold-that-thought-bucket/media/`
   - Destination: `s3://hold-that-thought-archive/media/`
2. Preserve folder structure:
   - `media/pictures/` → `media/pictures/`
   - `media/videos/` → `media/videos/`
   - `media/documents/` → `media/documents/`
3. Copy all files preserving metadata
4. Generate report of migrated files
5. Support dry-run mode

**Verification Checklist:**
- [x] All media files copied to new bucket
- [x] Folder structure preserved
- [x] Content types preserved
- [x] Report lists all migrated files
- [x] No files missed

**Testing Instructions:**
- Run in dry-run mode first
- Verify file count matches source
- Spot check a few files for integrity

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): add media files migration script

- Copy media files preserving structure
- Maintain content types and metadata
- Generate migration report
```

---

### Task 7: Execute Migration and Validate

**Goal:** Run the migration scripts and validate the results.

**Files to Modify/Create:**
- `backend/scripts/validate-migration.js` - Validation script

**Prerequisites:**
- Tasks 5-6 complete (migration scripts)
- Archive bucket exists

**Implementation Steps:**
1. Run letter migration in dry-run mode first:
   ```bash
   node backend/scripts/migrate-letters.js \
     --source-bucket hold-that-thought-bucket \
     --dest-bucket hold-that-thought-archive \
     --dry-run
   ```
2. Review migration report for issues
3. Fix any date extraction failures manually
4. Run actual migration
5. Create validation script that:
   - Counts files in destination
   - Verifies each markdown file has corresponding PDF
   - Verifies frontmatter removed
   - Verifies date format in filename
6. Run media migration
7. Validate media migration

**Verification Checklist:**
- [x] All ~180 letters migrated
- [x] All markdown files have frontmatter stripped
- [x] All files follow date-based naming
- [x] All PDFs paired with markdown files
- [x] Media files migrated correctly
- [x] Validation script passes

**Testing Instructions:**
- Run validation script after migration
- Manually spot-check 5-10 random letters
- Verify PDF downloads work from new location

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): add validation script and execute migration

- Add migration validation script
- Verify all letters migrated correctly
- Verify media files migrated
- Document any manual interventions needed
```

---

### Task 8: Update Deploy Script Migration Integration

**Goal:** Integrate the migration scripts into the deploy workflow so first-time deployments automatically migrate data.

**Files to Modify:**
- `backend/scripts/deploy.sh` - Add migration integration

**Prerequisites:**
- Task 7 complete (migration validated)
- Phase 0 Task 2 complete (deploy script has prompts)

**Implementation Steps:**
1. Add migration check to deploy script:
   ```bash
   if [ "$LETTERS_MIGRATED" != "true" ] && [ -n "$LETTERS_SOURCE_URI" ]; then
     echo "Running letter migration..."
     node scripts/migrate-letters.js \
       --source-bucket $(extract-bucket $LETTERS_SOURCE_URI) \
       --source-prefix $(extract-prefix $LETTERS_SOURCE_URI) \
       --dest-bucket $ARCHIVE_BUCKET \
       --dest-prefix letters/

     # Mark as migrated
     echo "LETTERS_MIGRATED=true" >> "$ENV_DEPLOY_FILE"
   fi
   ```
2. Add error handling for migration failures
3. Add option to force re-migration: `--force-migrate`
4. Ensure migration runs before SAM deploy

**Verification Checklist:**
- [x] Migration runs on first deploy with source URI
- [x] Migration skipped on subsequent deploys
- [x] Force flag triggers re-migration
- [x] Errors halt deployment with clear message
- [x] Migration status saved to .env.deploy

**Testing Instructions:**
- Test fresh deploy flow
- Test deploy with existing migration
- Test force-migrate flag

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(deploy): integrate migration into deployment workflow

- Run letter migration on first deploy
- Skip migration if already completed
- Add force-migrate option
- Handle migration errors gracefully
```

---

## Phase Verification

After completing all tasks in Phase 1:

1. **Migration Validation:**
   ```bash
   node backend/scripts/validate-migration.js \
     --bucket hold-that-thought-archive \
     --prefix letters/
   ```
   - All letters present with correct naming
   - All PDFs paired with markdown
   - No frontmatter in markdown files

2. **S3 Structure Verification:**
   ```bash
   aws s3 ls s3://hold-that-thought-archive/letters/ | head -20
   ```
   - Files named like `2016-02-10.md`, `2016-02-10.pdf`
   - Any collisions handled with slug suffix

3. **Media Verification:**
   ```bash
   aws s3 ls s3://hold-that-thought-archive/media/ --recursive | wc -l
   ```
   - Count matches original bucket

4. **Unit Tests:**
   ```bash
   pnpm test -- tests/unit/migration/
   ```
   - All migration utility tests pass

5. **Deploy Integration Test:**
   ```bash
   cd backend && ./scripts/deploy.sh --dry-run
   ```
   - Migration step appears in workflow
   - Configuration saved correctly

## Known Limitations

- Date extraction may fail for some letters requiring manual intervention
- Very old letters may have unusual date formats not covered
- Migration is one-way (no automatic rollback)

## Technical Debt

- Consider adding CloudWatch logging for production migration runs
- May want to add checksum verification for file integrity
- Could add parallel processing for faster migration of large datasets
