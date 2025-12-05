# Phase 2: Backend - DynamoDB & Letters API

## Phase Goal

Extend the existing backend to support letter storage in DynamoDB with version history, and create API endpoints for listing letters, retrieving content, editing, and managing versions. This phase also implements the deploy-time DynamoDB population from migrated S3 files.

**Success Criteria:**
- DynamoDB schema extended with letter entities and versions
- Letters API endpoints functional (list, get, update, versions, revert)
- Deploy script populates DynamoDB from S3 on first run
- All API endpoints authenticated via Cognito
- Unit tests pass with mocked DynamoDB

**Estimated Tokens:** ~30,000

## Prerequisites

- Phase 0 complete (utils updated with letter prefixes)
- Phase 1 complete (letters migrated to S3 with correct naming)
- Archive bucket populated with `/letters/` prefix

## Tasks

### Task 1: Create Letters Route Handler

**Goal:** Create the Lambda route handler for letters API following existing patterns.

**Files to Create:**
- `backend/lambdas/api/routes/letters.js` - Letters route handler

**Prerequisites:**
- Phase 0 Task 4 complete (utils have letter key builders)

**Implementation Steps:**
1. Create letters.js following existing route patterns (see media.js, comments.js)
2. Implement route dispatcher:
   ```javascript
   async function handle(event, context) {
     const { requesterId } = context
     const method = event.httpMethod
     const resource = event.resource

     if (method === 'GET' && resource === '/letters') {
       return await listLetters(event)
     }
     if (method === 'GET' && resource === '/letters/{date}') {
       return await getLetter(event)
     }
     if (method === 'PUT' && resource === '/letters/{date}') {
       return await updateLetter(event, requesterId)
     }
     if (method === 'GET' && resource === '/letters/{date}/versions') {
       return await getVersions(event)
     }
     if (method === 'POST' && resource === '/letters/{date}/revert') {
       return await revertToVersion(event, requesterId)
     }
     if (method === 'GET' && resource === '/letters/{date}/pdf') {
       return await getPdfUrl(event)
     }

     return errorResponse(404, 'Route not found')
   }
   ```
3. Implement stub functions that return placeholder responses
4. Export handle function

**Verification Checklist:**
- [ ] Route dispatcher handles all letter endpoints
- [ ] Stub functions return appropriate status codes
- [ ] Error handling follows existing patterns
- [ ] Module exports handle function

**Testing Instructions:**
Create `tests/unit/letters-handler.test.js` with basic routing tests:
```javascript
describe('letters API Lambda', () => {
  describe('routing', () => {
    it('should route GET /letters to listLetters', async () => { ... })
    it('should route GET /letters/{date} to getLetter', async () => { ... })
    it('should return 404 for unknown routes', async () => { ... })
  })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): create letters route handler structure

- Add route dispatcher for letters endpoints
- Implement stub functions for all operations
- Follow existing route handler patterns
```

---

### Task 2: Register Letters Routes in API Lambda

**Goal:** Wire the letters routes into the main API Lambda handler.

**Files to Modify:**
- `backend/lambdas/api/index.js` - Main Lambda handler

**Prerequisites:**
- Task 1 complete (letters.js exists)

**Implementation Steps:**
1. Import letters route handler:
   ```javascript
   const letters = require('./routes/letters')
   ```
2. Add letters routes to route matching logic
3. Ensure authentication context passed to letters handler
4. Maintain existing route priority

**Verification Checklist:**
- [ ] Letters routes accessible through main handler
- [ ] Authentication context passed correctly
- [ ] Existing routes unaffected
- [ ] Handler returns appropriate responses

**Testing Instructions:**
- Update existing handler tests to verify letters routes registered
- Test that unknown routes still return 404

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): register letters routes in main handler

- Import and register letters route handler
- Pass authentication context to handler
- Maintain existing route behavior
```

---

### Task 3: Add Letters Routes to SAM Template

**Goal:** Define API Gateway routes for letters endpoints in the SAM template.

**Files to Modify:**
- `backend/template.yaml` - SAM template

**Prerequisites:**
- Task 2 complete (routes registered in handler)

**Implementation Steps:**
1. Add letters events to ApiFunction:
   ```yaml
   # Letters
   ListLetters:
     Type: Api
     Properties:
       Path: /letters
       Method: get
   GetLetter:
     Type: Api
     Properties:
       Path: /letters/{date}
       Method: get
   UpdateLetter:
     Type: Api
     Properties:
       Path: /letters/{date}
       Method: put
   GetLetterVersions:
     Type: Api
     Properties:
       Path: /letters/{date}/versions
       Method: get
   RevertLetterVersion:
     Type: Api
     Properties:
       Path: /letters/{date}/revert
       Method: post
   GetLetterPdf:
     Type: Api
     Properties:
       Path: /letters/{date}/pdf
       Method: get
   ```
2. All routes use existing CognitoAuthorizer
3. Validate template after changes

**Verification Checklist:**
- [ ] All six letter endpoints defined
- [ ] All endpoints use Cognito authorization
- [ ] Template validates with `sam validate`
- [ ] Path parameters correctly named

**Testing Instructions:**
- Run `sam validate --template backend/template.yaml`
- Run `sam build` to verify compilation
- Deploy to test and verify routes in API Gateway console

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): add letters API routes to SAM template

- Define API Gateway routes for letters endpoints
- Configure Cognito authorization
- Add path parameter for date
```

---

### Task 4: Implement List Letters Endpoint

**Goal:** Implement the endpoint to list all letters in chronological order.

**Files to Modify:**
- `backend/lambdas/api/routes/letters.js` - Implement listLetters

**Prerequisites:**
- Task 3 complete (routes in SAM template)

**Implementation Steps:**
1. Implement `listLetters(event)`:
   ```javascript
   async function listLetters(event) {
     const limit = parseInt(event.queryStringParameters?.limit) || 50
     const cursor = event.queryStringParameters?.cursor

     // Query GSI1 for all letters sorted by date
     // GSI1 already exists in the DynamoDB table (defined in template.yaml)
     // Letters use: GSI1PK = 'LETTERS', GSI1SK = date (e.g., '2016-02-10')
     const params = {
       TableName: TABLE_NAME,
       IndexName: 'GSI1',
       KeyConditionExpression: 'GSI1PK = :pk',
       ExpressionAttributeValues: { ':pk': 'LETTERS' },
       Limit: limit,
       ScanIndexForward: false, // Newest first
     }

     if (cursor) {
       params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString())
     }

     const result = await docClient.send(new QueryCommand(params))

     return successResponse({
       items: result.Items.map(item => ({
         date: item.GSI1SK, // Date is stored in GSI1SK
         title: item.title,
         originalTitle: item.originalTitle,
         updatedAt: item.updatedAt,
       })),
       nextCursor: result.LastEvaluatedKey
         ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
         : null,
     })
   }
   ```

**Note:** GSI1 (GSI1PK + GSI1SK) already exists in the DynamoDB table. No schema changes needed - just use the existing index.

2. Handle pagination with cursor
3. Return only metadata (not full content)

**Verification Checklist:**
- [ ] Returns list of letters with metadata
- [ ] Sorted by date (newest first)
- [ ] Pagination works correctly
- [ ] Handles empty results

**Testing Instructions:**
Add tests to `tests/unit/letters-handler.test.js`:
```javascript
describe('GET /letters', () => {
  it('should return paginated letters', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { PK: 'LETTER#2016-02-10', SK: 'CURRENT', title: 'Family Update' },
        { PK: 'LETTER#2015-12-25', SK: 'CURRENT', title: 'Christmas' },
      ],
    })
    // Verify response
  })

  it('should handle pagination cursor', async () => { ... })
  it('should return empty list when no letters', async () => { ... })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): implement list letters endpoint

- Query DynamoDB for all letters
- Return paginated results sorted by date
- Include metadata only (not content)
```

---

### Task 5: Implement Get Letter Endpoint

**Goal:** Implement the endpoint to retrieve a single letter's content by date.

**Files to Modify:**
- `backend/lambdas/api/routes/letters.js` - Implement getLetter

**Prerequisites:**
- Task 4 complete

**Implementation Steps:**
1. Implement `getLetter(event)`:
   ```javascript
   async function getLetter(event) {
     const date = event.pathParameters?.date

     if (!date || !isValidDate(date)) {
       return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
     }

     const result = await docClient.send(new GetCommand({
       TableName: TABLE_NAME,
       Key: keys.letter(date),
     }))

     if (!result.Item) {
       return errorResponse(404, 'Letter not found')
     }

     return successResponse({
       date,
       title: result.Item.title,
       originalTitle: result.Item.originalTitle,
       content: result.Item.content,
       pdfKey: result.Item.pdfKey,
       createdAt: result.Item.createdAt,
       updatedAt: result.Item.updatedAt,
       lastEditedBy: result.Item.lastEditedBy,
       versionCount: result.Item.versionCount || 0,
     })
   }
   ```
2. Add date validation helper
3. Return full letter content

**Verification Checklist:**
- [ ] Returns letter content for valid date
- [ ] Returns 404 for non-existent letter
- [ ] Validates date format
- [ ] Includes all metadata fields

**Testing Instructions:**
```javascript
describe('GET /letters/{date}', () => {
  it('should return letter content', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        PK: 'LETTER#2016-02-10',
        SK: 'CURRENT',
        title: 'Family Update',
        content: 'Dear Family...',
        pdfKey: 'letters/2016-02-10.pdf',
      },
    })
    // Verify response
  })

  it('should return 404 for missing letter', async () => { ... })
  it('should validate date format', async () => { ... })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): implement get letter endpoint

- Retrieve single letter by date
- Return full content and metadata
- Validate date parameter format
```

---

### Task 6: Implement Update Letter Endpoint with Versioning

**Goal:** Implement the endpoint to update letter content while preserving version history.

**Files to Modify:**
- `backend/lambdas/api/routes/letters.js` - Implement updateLetter

**Prerequisites:**
- Task 5 complete

**Implementation Steps:**
1. Implement `updateLetter(event, requesterId)`:
   ```javascript
   async function updateLetter(event, requesterId) {
     const date = event.pathParameters?.date
     const body = JSON.parse(event.body || '{}')
     const { content, title } = body

     if (!content) {
       return errorResponse(400, 'Content is required')
     }

     // Get current letter
     const current = await docClient.send(new GetCommand({
       TableName: TABLE_NAME,
       Key: keys.letter(date),
     }))

     if (!current.Item) {
       return errorResponse(404, 'Letter not found')
     }

     const now = new Date().toISOString()
     const versionNumber = (current.Item.versionCount || 0) + 1

     // Create version of current content
     await docClient.send(new PutCommand({
       TableName: TABLE_NAME,
       Item: {
         ...keys.letterVersion(date, now),
         content: current.Item.content,
         title: current.Item.title,
         editedBy: current.Item.lastEditedBy,
         editedAt: current.Item.updatedAt,
         versionNumber: current.Item.versionCount || 0,
         entityType: 'LETTER_VERSION',
       },
     }))

     // Update current letter
     await docClient.send(new UpdateCommand({
       TableName: TABLE_NAME,
       Key: keys.letter(date),
       UpdateExpression: 'SET content = :content, title = :title, updatedAt = :now, lastEditedBy = :editor, versionCount = :vc',
       ExpressionAttributeValues: {
         ':content': content,
         ':title': title || current.Item.title,
         ':now': now,
         ':editor': requesterId,
         ':vc': versionNumber,
       },
     }))

     return successResponse({
       date,
       title: title || current.Item.title,
       content,
       updatedAt: now,
       versionCount: versionNumber,
     })
   }
   ```
2. Create version before updating
3. Track version count

**Verification Checklist:**
- [ ] Creates version of previous content
- [ ] Updates current letter with new content
- [ ] Increments version count
- [ ] Records editor information
- [ ] Returns updated letter

**Testing Instructions:**
```javascript
describe('PUT /letters/{date}', () => {
  it('should update letter and create version', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { PK: 'LETTER#2016-02-10', SK: 'CURRENT', content: 'Old', versionCount: 0 },
    })
    ddbMock.on(PutCommand).resolves({})
    ddbMock.on(UpdateCommand).resolves({})

    // Verify version created and current updated
  })

  it('should require content', async () => { ... })
  it('should require authentication', async () => { ... })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): implement update letter with versioning

- Create version record before updating
- Track version count on letter
- Record editor information
```

---

### Task 7: Implement Get Versions and Revert Endpoints

**Goal:** Implement endpoints for listing versions and reverting to a previous version.

**Files to Modify:**
- `backend/lambdas/api/routes/letters.js` - Implement getVersions and revertToVersion

**Prerequisites:**
- Task 6 complete

**Implementation Steps:**
1. Implement `getVersions(event)`:
   ```javascript
   async function getVersions(event) {
     const date = event.pathParameters?.date

     const result = await docClient.send(new QueryCommand({
       TableName: TABLE_NAME,
       KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
       ExpressionAttributeValues: {
         ':pk': `LETTER#${date}`,
         ':prefix': 'VERSION#',
       },
       ScanIndexForward: false, // Newest first
     }))

     return successResponse({
       versions: result.Items.map(v => ({
         timestamp: v.SK.replace('VERSION#', ''),
         versionNumber: v.versionNumber,
         editedBy: v.editedBy,
         editedAt: v.editedAt,
       })),
     })
   }
   ```

2. Implement `revertToVersion(event, requesterId)`:
   ```javascript
   async function revertToVersion(event, requesterId) {
     const date = event.pathParameters?.date
     const body = JSON.parse(event.body || '{}')
     const { versionTimestamp } = body

     // Get the version to revert to
     const version = await docClient.send(new GetCommand({
       TableName: TABLE_NAME,
       Key: keys.letterVersion(date, versionTimestamp),
     }))

     if (!version.Item) {
       return errorResponse(404, 'Version not found')
     }

     // Use updateLetter logic to set content (creates new version)
     // ... (call updateLetter internally or duplicate logic)

     return successResponse({ message: 'Reverted successfully', ... })
   }
   ```

**Verification Checklist:**
- [ ] getVersions returns list of all versions
- [ ] Versions sorted by timestamp (newest first)
- [ ] revertToVersion copies version content to current
- [ ] Revert creates a new version (audit trail)

**Testing Instructions:**
```javascript
describe('GET /letters/{date}/versions', () => {
  it('should return list of versions', async () => { ... })
  it('should return empty list for letter with no edits', async () => { ... })
})

describe('POST /letters/{date}/revert', () => {
  it('should revert to specified version', async () => { ... })
  it('should return 404 for invalid version', async () => { ... })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): implement version history and revert endpoints

- List all versions for a letter
- Revert to previous version (creates new version)
- Preserve full audit trail
```

---

### Task 8: Implement PDF URL Endpoint

**Goal:** Implement endpoint to get presigned URL for downloading the original PDF.

**Files to Modify:**
- `backend/lambdas/api/routes/letters.js` - Implement getPdfUrl

**Prerequisites:**
- Task 5 complete (getLetter works)

**Implementation Steps:**
1. Implement `getPdfUrl(event)`:
   ```javascript
   async function getPdfUrl(event) {
     const date = event.pathParameters?.date

     // Get letter to find PDF key
     const letter = await docClient.send(new GetCommand({
       TableName: TABLE_NAME,
       Key: keys.letter(date),
     }))

     if (!letter.Item || !letter.Item.pdfKey) {
       return errorResponse(404, 'PDF not found')
     }

     const presignedUrl = await getSignedUrl(
       s3Client,
       new GetObjectCommand({
         Bucket: BUCKETS.archive,
         Key: letter.Item.pdfKey,
       }),
       { expiresIn: 3600 }
     )

     return successResponse({
       downloadUrl: presignedUrl,
       filename: `${date}.pdf`,
     })
   }
   ```
2. Generate presigned URL for S3 object
3. Return URL with suggested filename

**Verification Checklist:**
- [ ] Returns presigned URL for PDF
- [ ] URL expires after 1 hour
- [ ] Returns 404 if letter or PDF not found
- [ ] Filename suggestion matches date

**Testing Instructions:**
```javascript
describe('GET /letters/{date}/pdf', () => {
  it('should return presigned URL for PDF', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { pdfKey: 'letters/2016-02-10.pdf' },
    })
    // Mock S3 presigner
    // Verify URL returned
  })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): implement PDF download URL endpoint

- Generate presigned S3 URL for PDF
- Include suggested filename
- Handle missing PDFs gracefully
```

---

### Task 9: Create DynamoDB Population Script

**Goal:** Create a script that populates DynamoDB with letter metadata from the migrated S3 files.

**Files to Create:**
- `backend/scripts/populate-letters-db.js` - DynamoDB population script

**Prerequisites:**
- Phase 1 complete (letters in S3 with correct naming)
- Task 5 complete (letter schema defined)

**Implementation Steps:**
1. Create script that:
   - Lists all files in `s3://archive-bucket/letters/`
   - Groups markdown and PDF files by date
   - For each letter:
     - Read markdown content from S3
     - Extract title from first heading or filename
     - Create DynamoDB item with:
       ```javascript
       {
         PK: 'LETTER#2016-02-10',
         SK: 'CURRENT',
         GSI1PK: 'LETTERS',
         GSI1SK: '2016-02-10',
         content: markdownContent,
         title: extractedTitle,
         originalTitle: folderName, // Preserved from migration
         pdfKey: 'letters/2016-02-10.pdf',
         createdAt: now,
         updatedAt: now,
         versionCount: 0,
         entityType: 'LETTER',
       }
       ```
2. Support dry-run mode
3. Support incremental population (skip existing)
4. Generate report of populated letters

**Verification Checklist:**
- [ ] Reads all letters from S3
- [ ] Creates correct DynamoDB items
- [ ] Handles letters without PDFs
- [ ] Skips already-populated letters
- [ ] Reports progress and results

**Testing Instructions:**
Create `tests/unit/migration/populate-letters-db.test.js`:
```javascript
describe('populate letters DB', () => {
  it('should create correct DynamoDB items', async () => { ... })
  it('should skip existing letters', async () => { ... })
})
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(migration): create DynamoDB population script

- Read letters from S3 archive bucket
- Create DynamoDB items with full schema
- Support dry-run and incremental modes
```

---

### Task 10: Integrate DB Population into Deploy Script

**Goal:** Add DynamoDB population step to the deployment workflow.

**Files to Modify:**
- `backend/scripts/deploy.sh` - Add DB population step

**Prerequisites:**
- Task 9 complete (population script exists)
- Phase 1 Task 8 complete (S3 migration integrated)

**Implementation Steps:**
1. Add DB population after SAM deploy:
   ```bash
   # After successful SAM deploy
   if [ "$LETTERS_DB_POPULATED" != "true" ]; then
     echo "Populating DynamoDB with letter data..."
     node scripts/populate-letters-db.js \
       --bucket $ARCHIVE_BUCKET \
       --table $TABLE_NAME \
       --region $AWS_REGION

     if [ $? -eq 0 ]; then
       sed -i 's/LETTERS_DB_POPULATED=.*/LETTERS_DB_POPULATED=true/' "$ENV_DEPLOY_FILE"
       echo "LETTERS_DB_POPULATED=true" >> "$ENV_DEPLOY_FILE"
     fi
   fi
   ```
2. Run population after stack is deployed (table exists)
3. Mark completion in .env.deploy
4. Add `--force-populate` flag for re-running

**Verification Checklist:**
- [ ] Population runs after SAM deploy
- [ ] Skips if already populated
- [ ] Force flag triggers re-population
- [ ] Errors reported clearly

**Testing Instructions:**
- Deploy to test stack
- Verify letters queryable via API
- Test force-populate flag

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(deploy): integrate DynamoDB population into deployment

- Run population after SAM deploy
- Track population status in config
- Support force re-population
```

---

## Phase Verification

After completing all tasks in Phase 2:

1. **API Endpoint Tests:**
   ```bash
   pnpm test -- tests/unit/letters-handler.test.js
   ```
   - All letter API tests pass

2. **SAM Validation:**
   ```bash
   cd backend && sam validate && sam build
   ```
   - Template valid with letter routes

3. **Integration Test (Manual):**
   Deploy to test stack and verify:
   ```bash
   # List letters
   curl -H "Authorization: Bearer $TOKEN" $API_URL/letters

   # Get single letter
   curl -H "Authorization: Bearer $TOKEN" $API_URL/letters/2016-02-10

   # Update letter
   curl -X PUT -H "Authorization: Bearer $TOKEN" \
     -d '{"content":"Updated content"}' \
     $API_URL/letters/2016-02-10

   # Get versions
   curl -H "Authorization: Bearer $TOKEN" $API_URL/letters/2016-02-10/versions

   # Get PDF URL
   curl -H "Authorization: Bearer $TOKEN" $API_URL/letters/2016-02-10/pdf
   ```

4. **DynamoDB Verification:**
   ```bash
   aws dynamodb query \
     --table-name HoldThatThought \
     --index-name GSI1 \
     --key-condition-expression "GSI1PK = :pk" \
     --expression-attribute-values '{":pk":{"S":"LETTERS"}}' \
     --limit 5
   ```
   - Returns letter items

## Known Limitations

- No search functionality (list only, no content search)
- Version history is unbounded (no cleanup)
- No batch operations for letters

## Technical Debt

- Consider adding search via DynamoDB Streams + OpenSearch
- May want to add letter categories/tags in future
- Could optimize large content storage with S3 + DynamoDB pointer
