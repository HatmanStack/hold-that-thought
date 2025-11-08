# Phase 1: Backend Foundation

## Phase Goal

Build the complete backend infrastructure for comments, profiles, and messaging features. This includes deploying 5 DynamoDB tables, 6 Lambda functions, and extending API Gateway with new endpoints. By the end of this phase, all backend APIs will be functional and testable via Postman/curl, ready for frontend integration.

**Success Criteria:**
- All DynamoDB tables created and accessible
- All Lambda functions deployed and tested
- API endpoints return correct responses with valid JWT tokens
- CloudWatch logging configured
- Unit tests pass for all Lambda handlers

**Estimated Tokens: ~95,000**

---

## Prerequisites

Before starting this phase:

- [ ] Read Phase 0 thoroughly (architecture decisions and patterns)
- [ ] AWS CLI configured with credentials (`aws sts get-caller-identity` succeeds)
- [ ] Access to existing Cognito User Pool and S3 bucket
- [ ] Node.js v22+ installed (`node --version`)
- [ ] Python 3.13+ with uv installed (`uv --version`)
- [ ] Existing API Gateway REST API ID (find with `aws apigateway get-rest-apis`)

---

## Task 1: Create CloudFormation Template for DynamoDB Tables

**Goal:** Define infrastructure as code for all 5 DynamoDB tables with proper keys, indexes, and streams.

**Files to Create:**
- `cloudformation/dynamodb-tables.yaml` - DynamoDB table definitions

**Implementation Steps:**

1. Create CloudFormation template following AWS best practices
2. Define all 5 tables: UserProfiles, Comments, CommentReactions, Messages, ConversationMembers
3. Configure partition keys and sort keys per Phase 0 schema
4. Add GSIs where specified (EmailIndex, UserCommentsIndex, RecentConversationsIndex)
5. Enable DynamoDB Streams with `NEW_AND_OLD_IMAGES` view type (needed for notifications)
6. Use `PAY_PER_REQUEST` billing mode (serverless, auto-scaling)
7. Add encryption at rest with AWS-managed keys
8. Enable point-in-time recovery for data protection
9. Add CloudFormation outputs for table names and ARNs (used by Lambda functions)

**Verification Checklist:**

- [ ] Template validates: `aws cloudformation validate-template --template-body file://cloudformation/dynamodb-tables.yaml`
- [ ] All table names follow pattern: `hold-that-thought-{resource}`
- [ ] Partition/sort keys match Phase 0 schema exactly
- [ ] GSIs configured for UserComments, Email, RecentConversations
- [ ] Streams enabled on Comments, Reactions, Messages tables
- [ ] Outputs include all table names and ARNs

**Testing Instructions:**

- Deploy to test stack: `aws cloudformation create-stack --stack-name htt-dynamo-test --template-body file://cloudformation/dynamodb-tables.yaml`
- Verify tables exist: `aws dynamodb list-tables`
- Check stream status: `aws dynamodb describe-table --table-name hold-that-thought-comments --query 'Table.StreamSpecification'`
- Clean up test stack: `aws cloudformation delete-stack --stack-name htt-dynamo-test`

**Commit Message Template:**
```
feat(infra): add DynamoDB tables CloudFormation template

- Define UserProfiles, Comments, Reactions, Messages, ConversationMembers tables
- Configure GSIs for user lookups and comment history
- Enable DynamoDB Streams for notification triggers
- Add point-in-time recovery and encryption

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 2: Deploy DynamoDB Tables to AWS

**Goal:** Create actual DynamoDB tables in AWS account using CloudFormation.

**Prerequisites:**
- Task 1 complete (CloudFormation template created)

**Implementation Steps:**

1. Review CloudFormation template one final time
2. Deploy to production: `aws cloudformation create-stack --stack-name hold-that-thought-dynamodb --template-body file://cloudformation/dynamodb-tables.yaml`
3. Monitor stack creation: `aws cloudformation describe-stack-events --stack-name hold-that-thought-dynamodb`
4. Wait for CREATE_COMPLETE status (~2-3 minutes)
5. Export table names to environment variables for later use
6. Test table access: List tables, describe one table, put/get a test item

**Verification Checklist:**

- [ ] Stack status is CREATE_COMPLETE: `aws cloudformation describe-stacks --stack-name hold-that-thought-dynamodb --query 'Stacks[0].StackStatus'`
- [ ] All 5 tables visible in AWS Console DynamoDB section
- [ ] Can write test item to UserProfiles table
- [ ] Can read test item back
- [ ] Streams are active on Comments, Reactions, Messages tables

**Testing Instructions:**

```bash
# Test write to UserProfiles table
aws dynamodb put-item \
  --table-name hold-that-thought-user-profiles \
  --item '{"userId": {"S": "test-123"}, "email": {"S": "test@example.com"}, "displayName": {"S": "Test User"}}'

# Test read
aws dynamodb get-item \
  --table-name hold-that-thought-user-profiles \
  --key '{"userId": {"S": "test-123"}}'

# Clean up test item
aws dynamodb delete-item \
  --table-name hold-that-thought-user-profiles \
  --key '{"userId": {"S": "test-123"}}'
```

**Commit Message Template:**
```
chore(infra): deploy DynamoDB tables to AWS

- Create hold-that-thought-dynamodb CloudFormation stack
- Deploy UserProfiles, Comments, Reactions, Messages, ConversationMembers
- Verify table access and stream configuration

Estimated tokens: ~2000
```

**Estimated Tokens: ~2000**

---

## Task 3: Create Profile API Lambda Function

**Goal:** Implement Lambda function for user profile CRUD operations (GET, PUT profile data).

**Files to Create:**
- `lambdas/profile-api/index.js` - Lambda handler
- `lambdas/profile-api/package.json` - Dependencies
- `lambdas/profile-api/test/handler.test.js` - Unit tests

**Prerequisites:**
- Task 2 complete (DynamoDB tables deployed)

**Implementation Steps:**

1. Create Lambda function directory structure
2. Initialize npm project: `pnpm init` in `lambdas/profile-api/`
3. Install dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
4. Implement handler with routes:
   - GET /profile/{userId} - Retrieve user profile
   - PUT /profile - Update own profile
   - GET /profile/{userId}/comments - Get user's comment history (paginated)
5. Extract userId from JWT claims: `event.requestContext.authorizer.claims.sub`
6. Validate privacy: Return 403 if profile is private and requester is not owner/admin
7. Validate inputs: Check required fields, max lengths (bio 500 chars)
8. Use DynamoDB DocumentClient for cleaner API
9. Handle errors gracefully (400, 403, 404, 500)
10. Add structured logging with context
11. Write unit tests using `aws-sdk-client-mock`

**Architecture Guidance:**

- Use route-based handler pattern: Check `event.httpMethod` and `event.resource` to determine action
- For GET profile: Query UserProfiles table by PK (userId)
- For PUT profile: Only allow user to update their own profile (validate `userId === JWT.sub`)
- For privacy check: If `isProfilePrivate === true`, check if requester is owner or admin
- Admin check: Look for `cognito:groups` claim containing "Admins" group
- Denormalize: When profile updated, do NOT backfill comments (intentional staleness)

**Verification Checklist:**

- [ ] Handler exports `exports.handler` function
- [ ] Handles GET /profile/{userId} correctly
- [ ] Handles PUT /profile with validation
- [ ] Returns 403 for private profiles (non-owner)
- [ ] Returns 400 for invalid inputs (missing fields, too-long bio)
- [ ] Returns 404 if userId doesn't exist
- [ ] Logs errors with structured context
- [ ] Unit tests cover happy path and error cases
- [ ] All tests pass: `pnpm test`

**Testing Instructions:**

Create test event files:

`test/events/get-profile.json`:
```json
{
  "httpMethod": "GET",
  "resource": "/profile/{userId}",
  "pathParameters": { "userId": "test-user-123" },
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-123",
        "email": "test@example.com"
      }
    }
  }
}
```

Test locally:
```bash
# Set environment variables
export USER_PROFILES_TABLE=hold-that-thought-user-profiles
export COMMENTS_TABLE=hold-that-thought-comments

# Run tests
pnpm test

# Test handler locally (requires DynamoDB Local or real AWS)
node -e "require('./index').handler(require('./test/events/get-profile.json'), {}).then(console.log)"
```

**Commit Message Template:**
```
feat(profile): create profile API Lambda function

- Implement GET /profile/{userId} endpoint
- Implement PUT /profile for self-updates
- Add privacy checks (private profiles return 403)
- Validate bio length (max 500 chars)
- Add unit tests for CRUD operations

Estimated tokens: ~12000
```

**Estimated Tokens: ~12000**

---

## Task 4: Create Comments API Lambda Function

**Goal:** Implement Lambda function for comment CRUD operations on letters and media.

**Files to Create:**
- `lambdas/comments-api/index.js` - Lambda handler
- `lambdas/comments-api/package.json` - Dependencies
- `lambdas/comments-api/test/handler.test.js` - Unit tests

**Prerequisites:**
- Task 2 complete (DynamoDB tables deployed)
- Task 3 complete (profile API pattern established)

**Implementation Steps:**

1. Create Lambda function directory and initialize npm
2. Install dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
3. Implement handler with routes:
   - GET /comments/{itemId} - List comments for letter/media (paginated)
   - POST /comments/{itemId} - Create new comment
   - PUT /comments/{itemId}/{commentId} - Edit own comment
   - DELETE /comments/{itemId}/{commentId} - Delete own comment (soft delete)
   - DELETE /admin/comments/{commentId} - Admin delete any comment
4. For POST: Generate commentId as `${new Date().toISOString()}#${uuid()}`
5. Denormalize user data: Fetch userName and userPhotoUrl from UserProfiles table, store in Comments
6. Validate comment text: Sanitize HTML (strip tags), enforce max 2000 chars
7. Track edit history: Store last 5 edits in `editHistory` array
8. Soft delete: Set `isDeleted: true`, keep item in table for audit
9. Add pagination support: Return `lastEvaluatedKey` for "Load More"
10. Write comprehensive unit tests

**Architecture Guidance:**

- **Pagination:** Use DynamoDB `Query` with `Limit` parameter, return `LastEvaluatedKey`
- **Sanitization:** Use library like `sanitize-html` or regex to strip HTML tags
- **Edit History:** When editing, prepend to `editHistory` array: `[{text: oldText, timestamp: now}, ...history].slice(0, 5)`
- **Denormalization:** Before creating comment, query UserProfiles table for displayName and profilePhotoUrl
- **Soft Delete:** For DELETE, use UpdateCommand to set `isDeleted: true` instead of DeleteCommand
- **Admin Check:** Extract `cognito:groups` from JWT, check if contains "Admins"

**Verification Checklist:**

- [ ] GET returns paginated comments (oldest first by default)
- [ ] POST creates comment with denormalized user data
- [ ] POST sanitizes HTML input (e.g., `<script>` tags removed)
- [ ] PUT only allows editing own comments
- [ ] PUT tracks edit history (max 5 entries)
- [ ] DELETE (user) soft-deletes own comments
- [ ] DELETE (admin) soft-deletes any comment
- [ ] Returns 400 for text > 2000 chars
- [ ] Returns 403 if editing someone else's comment
- [ ] Unit tests cover all routes and error cases
- [ ] All tests pass: `pnpm test`

**Testing Instructions:**

Create test events for each route (GET, POST, PUT, DELETE).

Example POST test:
```javascript
// test/handler.test.js
const { handler } = require('../index');
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
});

test('POST /comments/{itemId} creates comment', async () => {
  // Mock UserProfiles lookup
  ddbMock.on(GetCommand).resolves({
    Item: { userId: 'user-123', displayName: 'John Doe', profilePhotoUrl: 'https://...' }
  });
  
  // Mock comment creation
  ddbMock.on(PutCommand).resolves({});
  
  const event = {
    httpMethod: 'POST',
    resource: '/comments/{itemId}',
    pathParameters: { itemId: '/2015/christmas' },
    body: JSON.stringify({ commentText: 'Great letter!' }),
    requestContext: {
      authorizer: { claims: { sub: 'user-123', email: 'john@example.com' } }
    }
  };
  
  const response = await handler(event);
  expect(response.statusCode).toBe(201);
  
  const body = JSON.parse(response.body);
  expect(body.commentText).toBe('Great letter!');
  expect(body.userName).toBe('John Doe');
});
```

**Commit Message Template:**
```
feat(comments): create comments API Lambda function

- Implement GET /comments/{itemId} with pagination
- Implement POST /comments/{itemId} with HTML sanitization
- Implement PUT for editing own comments
- Implement DELETE with soft-delete pattern
- Add admin moderation endpoint
- Denormalize user name/photo for performance
- Track edit history (last 5 edits)
- Add comprehensive unit tests

Estimated tokens: ~15000
```

**Estimated Tokens: ~15000**

---

## Task 5: Create Reactions API Lambda Function

**Goal:** Implement Lambda function for adding/removing reactions (likes) on comments.

**Files to Create:**
- `lambdas/reactions-api/index.js` - Lambda handler
- `lambdas/reactions-api/package.json` - Dependencies
- `lambdas/reactions-api/test/handler.test.js` - Unit tests

**Prerequisites:**
- Task 2 complete (DynamoDB tables deployed)
- Task 4 complete (comments API for updating reaction counts)

**Implementation Steps:**

1. Create Lambda function directory and initialize npm
2. Install dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
3. Implement handler with routes:
   - POST /reactions/{commentId} - Toggle reaction (add if absent, remove if present)
   - GET /reactions/{commentId} - Get all reactions for a comment
4. For POST: Check if reaction exists (GET), then either PUT or DELETE
5. Update `reactionCount` in Comments table atomically (use UpdateCommand with ADD)
6. Return current reaction state (liked: true/false)
7. Write unit tests for toggle behavior

**Architecture Guidance:**

- **Toggle Pattern:** Query CommentReactions table for PK=commentId, SK=userId. If exists, delete; if not, create.
- **Atomic Counter:** Use DynamoDB UpdateExpression: `ADD reactionCount :val` where `:val` is 1 (add) or -1 (remove)
- **Idempotency:** POST should be idempotent - calling twice doesn't create duplicate reactions
- **Return Value:** Return `{ liked: true }` after adding, `{ liked: false }` after removing

**Verification Checklist:**

- [ ] POST toggles reaction (add → remove → add on repeated calls)
- [ ] POST updates reactionCount in Comments table
- [ ] GET returns list of all users who reacted
- [ ] Returns 404 if commentId doesn't exist
- [ ] Unit tests verify toggle behavior
- [ ] Unit tests verify atomic counter updates
- [ ] All tests pass: `pnpm test`

**Testing Instructions:**

Test toggle behavior:
```javascript
test('POST /reactions/{commentId} toggles reaction', async () => {
  // Mock: reaction doesn't exist initially
  ddbMock.on(GetCommand).resolvesOnce({ Item: undefined });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
  
  const event = {
    httpMethod: 'POST',
    resource: '/reactions/{commentId}',
    pathParameters: { commentId: 'comment-123' },
    requestContext: { authorizer: { claims: { sub: 'user-123' } } }
  };
  
  let response = await handler(event);
  expect(response.statusCode).toBe(200);
  expect(JSON.parse(response.body).liked).toBe(true);
  
  // Mock: reaction exists now
  ddbMock.on(GetCommand).resolvesOnce({ Item: { commentId: 'comment-123', userId: 'user-123' } });
  ddbMock.on(DeleteCommand).resolves({});
  
  response = await handler(event);
  expect(JSON.parse(response.body).liked).toBe(false);
});
```

**Commit Message Template:**
```
feat(comments): create reactions API Lambda function

- Implement POST /reactions/{commentId} toggle endpoint
- Implement GET /reactions/{commentId} to list all reactions
- Update reactionCount in Comments table atomically
- Add idempotent toggle behavior (add/remove)
- Write unit tests for toggle logic

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 6: Create Messages API Lambda Function

**Goal:** Implement Lambda function for direct messaging (1-on-1 and group conversations).

**Files to Create:**
- `lambdas/messages-api/index.js` - Lambda handler
- `lambdas/messages-api/package.json` - Dependencies
- `lambdas/messages-api/test/handler.test.js` - Unit tests

**Prerequisites:**
- Task 2 complete (DynamoDB tables deployed)

**Implementation Steps:**

1. Create Lambda function directory and initialize npm
2. Install dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `uuid`
3. Implement handler with routes:
   - GET /messages/conversations - List user's conversations (sorted by recent activity)
   - GET /messages/conversations/{convId} - Get messages in conversation (paginated)
   - POST /messages/conversations - Create new conversation
   - POST /messages/conversations/{convId} - Send message
   - POST /messages/upload - Generate presigned URL for attachment upload
   - PUT /messages/conversations/{convId}/read - Mark conversation as read
4. For 1-on-1 conversations: Generate conversationId as `{smaller-userId}#{larger-userId}` (consistent ordering)
5. For group conversations: Generate UUID as conversationId
6. Denormalize sender name in each message
7. Update ConversationMembers table with lastMessageAt and unreadCount
8. Handle attachments: Store S3 key, filename, contentType, size in message
9. Write unit tests for conversation creation, message sending, pagination

**Architecture Guidance:**

- **ConversationId Generation:**
  ```javascript
  function getConversationId(userIds) {
    if (userIds.length === 2) {
      return userIds.sort().join('#'); // e.g., "user-1#user-2"
    } else {
      return uuid(); // Group conversation
    }
  }
  ```

- **Pagination:** Query Messages table by conversationId, sort by messageId (timestamp-based), return lastEvaluatedKey

- **ConversationMembers Update:** When sending message, update all participants' ConversationMembers records:
  - Increment `unreadCount` for recipients (not sender)
  - Update `lastMessageAt` to current timestamp

- **Attachments:** POST /messages/upload returns presigned S3 URL. Client uploads file, then includes S3 key in message.

**Verification Checklist:**

- [ ] GET /messages/conversations returns sorted list (most recent first)
- [ ] POST /messages/conversations creates 1-on-1 and group conversations
- [ ] POST /messages/conversations/{convId} sends message
- [ ] Message includes denormalized sender name
- [ ] ConversationMembers table updated with lastMessageAt
- [ ] Unread count increments for recipients only
- [ ] PUT /read resets unreadCount to 0
- [ ] POST /upload returns valid presigned S3 URL (15-minute expiry)
- [ ] Returns 403 if user not in conversation participants
- [ ] Unit tests cover conversation creation, messaging, read receipts
- [ ] All tests pass: `pnpm test`

**Testing Instructions:**

Test conversation creation:
```javascript
test('POST /messages/conversations creates 1-on-1 conversation', async () => {
  ddbMock.on(PutCommand).resolves({});
  
  const event = {
    httpMethod: 'POST',
    resource: '/messages/conversations',
    body: JSON.stringify({ 
      participantIds: ['user-1', 'user-2'], 
      messageText: 'Hey!' 
    }),
    requestContext: { authorizer: { claims: { sub: 'user-1' } } }
  };
  
  const response = await handler(event);
  expect(response.statusCode).toBe(201);
  
  const body = JSON.parse(response.body);
  expect(body.conversationId).toBe('user-1#user-2'); // Sorted
  expect(body.message.messageText).toBe('Hey!');
});
```

**Commit Message Template:**
```
feat(messages): create messages API Lambda function

- Implement GET /messages/conversations (inbox view)
- Implement POST /conversations to create 1-on-1 and group chats
- Implement POST /conversations/{convId} to send messages
- Implement PUT /read to mark conversations as read
- Implement POST /upload for attachment presigned URLs
- Update ConversationMembers with lastMessageAt and unreadCount
- Add authorization checks (only participants can access)
- Write unit tests for messaging flows

Estimated tokens: ~18000
```

**Estimated Tokens: ~18000**

---

## Task 7: Create Notification Processor Lambda Function

**Goal:** Implement stream-triggered Lambda to send email notifications for comments, reactions, and DMs.

**Files to Create:**
- `lambdas/notification-processor/index.py` - Lambda handler (Python)
- `lambdas/notification-processor/requirements.txt` - Dependencies
- `lambdas/notification-processor/test_handler.py` - Unit tests

**Prerequisites:**
- Task 2 complete (DynamoDB tables with streams enabled)

**Implementation Steps:**

1. Create Lambda function directory
2. Create `requirements.txt` with dependencies: `boto3` (already in Lambda runtime)
3. Implement handler to process DynamoDB Stream events:
   - Trigger: Comments table stream (INSERT events) → notify users who commented on same item
   - Trigger: CommentReactions table stream (INSERT events) → notify comment author
   - Trigger: Messages table stream (INSERT events) → notify conversation participants
4. Parse stream event records (event type: INSERT/MODIFY/REMOVE)
5. Extract relevant data from `NewImage` (comment text, sender name, etc.)
6. Query UserProfiles table to get recipient email addresses
7. Send email via SES (boto3 `send_email`)
8. Implement debouncing: Don't send more than 1 email per 15 minutes per event type per user
9. Use DynamoDB to track last notification time (create NotificationLog table or use UserProfiles attribute)
10. Write unit tests using moto (mock boto3)

**Architecture Guidance:**

- **Stream Event Structure:**
  ```python
  for record in event['Records']:
      if record['eventName'] == 'INSERT':
          new_item = record['dynamodb']['NewImage']
          # Parse Dynamo JSON format: {'S': 'value'} → 'value'
  ```

- **Email Template Example (Comment Notification):**
  ```
  Subject: New comment on "{itemTitle}"
  
  {userName} commented on "{itemTitle}":
  
  "{commentText}"
  
  View the full discussion: https://holdthatthought.family{itemId}
  ```

- **Debouncing:** Store `lastCommentNotificationAt` timestamp in UserProfiles. Before sending, check if `now - last < 15 minutes`. If yes, skip.

- **SES Configuration:** Ensure SES is out of sandbox mode or verify recipient emails. For testing, use SES sandbox with verified emails.

**Verification Checklist:**

- [ ] Handler processes DynamoDB Stream events
- [ ] Parses INSERT events from Comments, Reactions, Messages tables
- [ ] Queries UserProfiles for recipient emails
- [ ] Sends email via SES with correct subject/body
- [ ] Implements debouncing (max 1 email per 15 min)
- [ ] Handles SES errors gracefully (log and continue)
- [ ] Unit tests mock DynamoDB and SES calls
- [ ] All tests pass: `uv run pytest`

**Testing Instructions:**

Create sample stream event:
```python
# test/events/comment_stream.json
{
  "Records": [
    {
      "eventName": "INSERT",
      "dynamodb": {
        "NewImage": {
          "itemId": {"S": "/2015/christmas"},
          "commentId": {"S": "2025-01-15T10:00:00.000Z#abc"},
          "userId": {"S": "user-123"},
          "userName": {"S": "John Doe"},
          "commentText": {"S": "Great letter!"},
          "itemTitle": {"S": "Christmas Letter 2015"}
        }
      }
    }
  ]
}
```

Test locally:
```bash
cd lambdas/notification-processor
uv pip install boto3 moto pytest
uv run pytest test_handler.py
```

**Commit Message Template:**
```
feat(notifications): create email notification processor

- Process DynamoDB Streams from Comments, Reactions, Messages tables
- Send email notifications via SES for new comments, reactions, DMs
- Implement 15-minute debouncing per event type
- Query UserProfiles for recipient emails
- Add unit tests with mocked SES calls

Estimated tokens: ~12000
```

**Estimated Tokens: ~12000**

---

## Task 8: Create Activity Aggregator Lambda Function

**Goal:** Implement stream-triggered Lambda to update user activity stats (comment count, last active).

**Files to Create:**
- `lambdas/activity-aggregator/index.py` - Lambda handler (Python)
- `lambdas/activity-aggregator/requirements.txt` - Dependencies
- `lambdas/activity-aggregator/test_handler.py` - Unit tests

**Prerequisites:**
- Task 2 complete (DynamoDB tables with streams enabled)

**Implementation Steps:**

1. Create Lambda function directory
2. Create `requirements.txt` with `boto3`
3. Implement handler to process DynamoDB Stream events:
   - Comments stream (INSERT) → increment `commentCount` in UserProfiles
   - Comments/Messages/Reactions stream (INSERT) → update `lastActive` timestamp
4. Use DynamoDB UpdateCommand with atomic ADD for counters
5. Write unit tests

**Architecture Guidance:**

- **Atomic Counter Update:**
  ```python
  dynamodb.update_item(
      TableName='hold-that-thought-user-profiles',
      Key={'userId': {'S': user_id}},
      UpdateExpression='ADD commentCount :inc SET lastActive = :now',
      ExpressionAttributeValues={
          ':inc': {'N': '1'},
          ':now': {'S': datetime.utcnow().isoformat()}
      }
  )
  ```

- **Handle Multiple Records:** Stream event can contain multiple records in batch. Process all.

**Verification Checklist:**

- [ ] Handler processes Comments stream INSERT events
- [ ] Increments commentCount atomically
- [ ] Updates lastActive timestamp on any activity
- [ ] Handles batch stream records (multiple inserts)
- [ ] Unit tests verify counter increments
- [ ] All tests pass: `uv run pytest`

**Testing Instructions:**

Similar to Task 7, create sample stream event and test handler.

**Commit Message Template:**
```
feat(profile): create activity aggregator Lambda

- Process DynamoDB Streams to update user stats
- Increment commentCount on new comments
- Update lastActive timestamp on any activity
- Use atomic counters for thread-safety
- Add unit tests for stream processing

Estimated tokens: ~6000
```

**Estimated Tokens: ~6000**

---

## Task 9: Package and Deploy Lambda Functions

**Goal:** Zip Lambda function code and deploy to AWS using CloudFormation or AWS CLI.

**Prerequisites:**
- Tasks 3-8 complete (all Lambda functions implemented)

**Implementation Steps:**

1. Create deployment script: `scripts/deploy-lambdas.sh`
2. For each Lambda:
   - Install dependencies: `pnpm install --prod` (Node.js) or `uv pip install -r requirements.txt -t .` (Python)
   - Zip code and dependencies: `zip -r function.zip .`
   - Upload to S3: `aws s3 cp function.zip s3://hold-that-thought-bucket/lambdas/`
3. Create CloudFormation template: `cloudformation/lambda-functions.yaml`
4. Define all 6 Lambda functions with:
   - Runtime (nodejs22.x or python3.13)
   - Handler (index.handler or index.lambda_handler)
   - Code location (S3 bucket + key)
   - Environment variables (table names)
   - IAM role with DynamoDB, S3, SES permissions
5. Add event source mappings for stream-triggered Lambdas (notification-processor, activity-aggregator)
6. Deploy stack: `aws cloudformation create-stack --stack-name hold-that-thought-lambdas --template-body file://cloudformation/lambda-functions.yaml`

**Verification Checklist:**

- [ ] All 6 Lambda functions zipped with dependencies
- [ ] Zip files uploaded to S3 bucket
- [ ] CloudFormation template defines all functions
- [ ] IAM role includes DynamoDB, S3, SES, CloudWatch Logs permissions
- [ ] Environment variables set (table names, bucket, SES email)
- [ ] Event source mappings configured for stream processors
- [ ] Stack deploys successfully: `aws cloudformation describe-stacks --stack-name hold-that-thought-lambdas`
- [ ] All Lambda functions visible in AWS Console
- [ ] Can invoke each function manually (test event)

**Testing Instructions:**

Test Lambda invocation:
```bash
# Invoke profile API Lambda
aws lambda invoke \
  --function-name profile-api-lambda \
  --payload file://test/events/get-profile.json \
  response.json

cat response.json
```

Test stream-triggered Lambda:
```bash
# Manually trigger with sample stream event
aws lambda invoke \
  --function-name notification-processor-lambda \
  --payload file://test/events/comment_stream.json \
  response.json
```

**Commit Message Template:**
```
chore(infra): package and deploy Lambda functions

- Create deployment script for Lambda packaging
- Upload function zips to S3
- Define Lambda functions in CloudFormation template
- Configure IAM roles with DynamoDB, S3, SES permissions
- Add event source mappings for DynamoDB Streams
- Deploy hold-that-thought-lambdas stack

Estimated tokens: ~5000
```

**Estimated Tokens: ~5000**

---

## Task 10: Extend API Gateway with New Endpoints

**Goal:** Add new API Gateway resources and methods for profiles, comments, reactions, messages.

**Files to Create:**
- `cloudformation/api-gateway-extensions.yaml` - API Gateway resource definitions

**Prerequisites:**
- Task 9 complete (Lambda functions deployed)

**Implementation Steps:**

1. Get existing API Gateway REST API ID: `aws apigateway get-rest-apis`
2. Create CloudFormation template to extend existing API
3. Define resources:
   - /profile, /profile/{userId}, /profile/{userId}/comments
   - /comments/{itemId}, /comments/{itemId}/{commentId}
   - /reactions/{commentId}
   - /messages/conversations, /messages/conversations/{convId}, /messages/upload
4. For each resource, define methods (GET, POST, PUT, DELETE)
5. Configure Lambda integrations (AWS_PROXY)
6. Attach Cognito authorizer to all methods
7. Enable CORS (OPTIONS method with proper headers)
8. Deploy to stage (e.g., "prod")

**Architecture Guidance:**

- **Lambda Integration:**
  ```yaml
  ProfileGetMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      HttpMethod: GET
      ResourceId: !Ref ProfileUserIdResource
      RestApiId: !Ref ExistingRestApi
      AuthorizationType: COGNITO_USER_POOLS
      AuthorizerId: !Ref CognitoAuthorizer
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${ProfileApiFunction.Arn}/invocations'
  ```

- **CORS:** Add OPTIONS method for each resource with headers:
  - Access-Control-Allow-Origin: *
  - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  - Access-Control-Allow-Headers: Content-Type, Authorization

**Verification Checklist:**

- [ ] CloudFormation template references existing API Gateway ID
- [ ] All resources (/profile, /comments, /reactions, /messages) defined
- [ ] All methods have Cognito authorizer
- [ ] Lambda integrations use AWS_PROXY
- [ ] CORS enabled on all resources
- [ ] Stack deploys successfully
- [ ] New endpoints visible in API Gateway console
- [ ] Deployment created for "prod" stage

**Testing Instructions:**

Test API endpoint with curl:
```bash
# Get JWT token from Cognito (use existing auth flow)
TOKEN="<your-jwt-token>"

# Test GET /profile/{userId}
curl -H "Authorization: Bearer $TOKEN" \
  https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/profile/test-user-123

# Expected: 200 OK with user profile JSON
```

**Commit Message Template:**
```
feat(api): extend API Gateway with profile, comments, messages endpoints

- Add /profile, /comments, /reactions, /messages resources
- Configure Lambda integrations for all endpoints
- Attach Cognito authorizer to all methods
- Enable CORS for frontend access
- Deploy to prod stage

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 11: Create Integration Tests for Backend APIs

**Goal:** Write end-to-end tests for all API endpoints using real AWS resources.

**Files to Create:**
- `tests/integration/profile.test.js` - Profile API tests
- `tests/integration/comments.test.js` - Comments API tests
- `tests/integration/reactions.test.js` - Reactions API tests
- `tests/integration/messages.test.js` - Messages API tests
- `tests/integration/setup.js` - Test setup (Cognito login, test data)

**Prerequisites:**
- Tasks 1-10 complete (all backend infrastructure deployed)

**Implementation Steps:**

1. Create integration test directory
2. Install dependencies: `pnpm add -D jest node-fetch aws-sdk`
3. Implement test setup:
   - Authenticate test user with Cognito (get JWT token)
   - Store token for use in API requests
4. Write tests for each API:
   - Profile: GET profile, PUT profile, GET comment history
   - Comments: Create comment, edit comment, delete comment, pagination
   - Reactions: Toggle reaction, get reactions
   - Messages: Create conversation, send message, list conversations, mark read
5. Test error cases: 400 (invalid input), 403 (unauthorized), 404 (not found)
6. Clean up test data after each test (delete created items)
7. Run tests: `pnpm test:integration`

**Architecture Guidance:**

- **Cognito Login:** Use AWS SDK to authenticate:
  ```javascript
  const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
  
  async function getAuthToken() {
    const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
    const response = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: 'test@example.com',
        PASSWORD: 'TestPassword123!'
      }
    }));
    return response.AuthenticationResult.AccessToken;
  }
  ```

- **API Requests:**
  ```javascript
  const response = await fetch(`${API_URL}/profile/test-user-123`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.email).toBe('test@example.com');
  ```

**Verification Checklist:**

- [ ] All API endpoints have integration tests
- [ ] Tests authenticate with Cognito before making requests
- [ ] Happy path tests pass (200 responses)
- [ ] Error case tests pass (400, 403, 404 responses)
- [ ] Pagination tested (comments, messages)
- [ ] Test data cleaned up after each test
- [ ] All integration tests pass: `pnpm test:integration`

**Testing Instructions:**

Setup test user in Cognito:
```bash
# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id <pool-id> \
  --username test@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id <pool-id> \
  --username test@example.com \
  --password TestPassword123! \
  --permanent

# Add to ApprovedUsers group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <pool-id> \
  --username test@example.com \
  --group-name ApprovedUsers
```

Run tests:
```bash
export API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/prod
export COGNITO_CLIENT_ID=<client-id>
pnpm test:integration
```

**Commit Message Template:**
```
test(api): add integration tests for all backend endpoints

- Create integration test suite for profile, comments, reactions, messages
- Implement Cognito authentication in test setup
- Test happy path and error cases (400, 403, 404)
- Test pagination for comments and messages
- Add cleanup after each test

Estimated tokens: ~10000
```

**Estimated Tokens: ~10000**

---

## Phase Verification

Before proceeding to Phase 2, verify:

### Infrastructure
- [ ] All 5 DynamoDB tables exist and accessible
- [ ] DynamoDB Streams enabled on Comments, Reactions, Messages tables
- [ ] All 6 Lambda functions deployed and invocable
- [ ] API Gateway extended with new endpoints
- [ ] Cognito authorizer attached to all endpoints
- [ ] CloudWatch Logs configured for all Lambdas

### Functionality
- [ ] Can create/read/update user profile via API
- [ ] Can create/list/edit/delete comments via API
- [ ] Can toggle reactions on comments via API
- [ ] Can create conversations and send messages via API
- [ ] Email notifications sent when comments/reactions/DMs created (test with real email)
- [ ] Activity aggregator updates commentCount and lastActive

### Testing
- [ ] All Lambda unit tests pass
- [ ] All integration tests pass
- [ ] Manual Postman/curl tests confirm expected behavior
- [ ] Error handling tested (invalid tokens, missing fields, etc.)

### Performance
- [ ] API response times < 500ms (test with `time curl ...`)
- [ ] DynamoDB queries efficient (check CloudWatch metrics for throttling)

### Cost
- [ ] DynamoDB PAY_PER_REQUEST (no provisioned capacity)
- [ ] Lambda function memory sized appropriately (512MB default)
- [ ] No unexpected charges in AWS Cost Explorer

---

## Known Limitations & Technical Debt

**Limitations introduced in this phase:**

1. **No Message Read Receipts:** Basic read/unread tracking only (unreadCount). No "delivered" or "read by X" indicators.
   - **Future:** Add `readBy` map to Messages table with timestamps

2. **Basic Notification Debouncing:** Simple 15-minute window. Could be more sophisticated.
   - **Future:** Use SQS + Lambda to batch notifications (e.g., digest emails)

3. **No Full-Text Search:** Comments/messages use basic DynamoDB queries. No search by keyword.
   - **Future:** Add OpenSearch for full-text search

4. **Denormalized Data Staleness:** If user changes name, old comments show old name.
   - **Intentional:** Preserves historical context. Document this as feature, not bug.

5. **No Rate Limiting:** APIs rely on API Gateway throttling only.
   - **Future:** Add per-user rate limits (e.g., 10 comments/minute)

**Technical Debt:**

- Lambda functions not using layers (duplicated dependencies)
  - **Refactor:** Create shared Lambda layer for aws-sdk, uuid, etc.
  
- Error messages expose internal details (e.g., DynamoDB errors)
  - **Fix:** Sanitize error messages before returning to client

- No automated CloudFormation rollback testing
  - **Add:** Test rollback scenarios in CI/CD

---

## Next Steps

Proceed to **Phase 2: Comments System** to build the frontend UI and integrate comments into letter/media pages.
