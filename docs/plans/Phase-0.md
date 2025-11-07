# Phase 0: Foundation & Architecture

This phase contains architecture decisions, design patterns, and technical foundations that apply to ALL subsequent phases. Read this thoroughly before beginning implementation.

## Architecture Decision Records (ADRs)

### ADR-001: DynamoDB Over RDS for Data Storage

**Decision:** Use DynamoDB with single-table design patterns instead of RDS (PostgreSQL/MySQL).

**Rationale:**
- Serverless-first: Matches existing Lambda architecture
- Cost-effective: PAY_PER_REQUEST billing (~$10/month vs $20+/month for RDS)
- No cold starts: DynamoDB always available (RDS requires connection pooling)
- Scales automatically: No capacity planning needed
- Existing patterns: Project already uses S3+Lambda, adding DynamoDB fits naturally

**Trade-offs:**
- More complex query patterns (no SQL joins)
- Denormalization required for performance
- Learning curve for NoSQL patterns

**Consequences:**
- All data access must be planned around partition/sort keys
- GSIs (Global Secondary Indexes) needed for alternate access patterns
- Atomic transactions limited to single partition key

---

### ADR-002: Flat Comments Over Threaded Replies

**Decision:** Comments are flat lists without nested replies.

**Rationale:**
- Simpler data model (no recursive queries)
- Easier UI implementation (no complex tree rendering)
- Better performance (single query for all comments)
- Family use case doesn't require deep discussions

**Trade-offs:**
- Cannot have focused sub-conversations
- @mentions might be needed to clarify responses

**Consequences:**
- Comments table uses simple itemId+commentId keys
- UI renders chronological list with "Load More" pagination
- Future feature: Add @mentions to reference other comments

---

### ADR-003: Asynchronous Messaging Over Real-Time WebSockets

**Decision:** Direct messages use asynchronous delivery (page refresh) with optional email notifications instead of WebSockets.

**Rationale:**
- Simpler implementation (REST API vs WebSocket infrastructure)
- Lower costs (no persistent connections)
- Family use case doesn't require instant messaging
- Existing architecture is REST-based

**Trade-offs:**
- Messages not instant (require refresh/polling)
- No typing indicators or presence detection
- Less "chat-like" experience

**Consequences:**
- Messages API uses standard Lambda+API Gateway
- Frontend polls for new messages on active conversation pages (30s interval)
- Email notifications bridge the "instant" gap

---

### ADR-004: Email Notifications via SES

**Decision:** Use Amazon SES for email notifications triggered by DynamoDB Streams.

**Rationale:**
- Asynchronous messaging needs out-of-band notifications
- SES integrates naturally with Lambda
- Cost-effective ($0.10 per 1000 emails)
- Existing AWS account likely has SES access

**Trade-offs:**
- Requires SES domain verification (or sandbox mode for testing)
- Email delivery delays (up to 5 minutes)
- Users must have valid email addresses

**Consequences:**
- notification-processor Lambda triggered by DynamoDB Streams
- Notification debouncing needed (max 1 email per 15 min per event type)
- Fallback: In-app notification badge if email fails

---

### ADR-005: Denormalization for Read Performance

**Decision:** Duplicate user data (name, photo) in Comments and Messages tables.

**Rationale:**
- Single-query performance (avoid lookups to UserProfiles table)
- DynamoDB best practice: optimize for reads, not writes
- User names/photos change infrequently

**Trade-offs:**
- Data staleness (if user changes name, old comments show old name)
- Storage overhead (duplicate data across tables)

**Consequences:**
- When creating comments/messages, copy userName and userPhotoUrl from UserProfiles
- Profile updates do NOT backfill old comments (intentional - shows historical name)
- Alternative: Background job to update if staleness becomes issue

---

## Data Schema Design

### Key Design Principles

1. **Partition Key Selection:** Choose high-cardinality keys to distribute load
   - Good: `userId`, `itemId` (many unique values)
   - Bad: `itemType` (only 2 values: letter/media)

2. **Sort Key for Ordering:** Use timestamp-based sort keys for chronological data
   - Format: `YYYY-MM-DDTHH:mm:ss.sssZ#UUID` (ISO 8601 + unique suffix)
   - Enables efficient "latest N items" queries

3. **GSI Strategy:** Create GSIs for alternate access patterns
   - Each GSI costs money - only create what you need
   - Project only required attributes (use `KEYS_ONLY` or specific attributes)

4. **Item Size Limits:** DynamoDB items limited to 400KB
   - Comments max 2000 chars (~4KB)
   - Messages max 5000 chars (~10KB)
   - Large content (photos) → S3, reference in DynamoDB

### Table Schemas

**UserProfiles Table:**
```
PK: userId (Cognito sub, e.g., "auth0|abc123")
Attributes:
  - email (String)
  - displayName (String)
  - profilePhotoUrl (String, S3 URL)
  - bio (String, max 500 chars)
  - familyRelationship (String, user-editable)
  - generation (String)
  - familyBranch (String)
  - joinedDate (ISO timestamp)
  - isProfilePrivate (Boolean)
  - commentCount (Number)
  - mediaUploadCount (Number)
  - lastActive (ISO timestamp)
  - createdAt, updatedAt (ISO timestamps)

GSI: EmailIndex
  - PK: email
  - Projection: ALL
  - Use case: Look up user by email
```

**Comments Table:**
```
PK: itemId (letter path or media S3 key, e.g., "/2015/christmas-letter" or "media/pictures/uuid_photo.jpg")
SK: commentId (timestamp#uuid, e.g., "2025-01-15T10:30:00.000Z#abc-123")
Attributes:
  - userId (String)
  - userName (String, denormalized)
  - userPhotoUrl (String, denormalized)
  - commentText (String, max 2000 chars)
  - createdAt (ISO timestamp)
  - updatedAt (ISO timestamp, null if never edited)
  - isEdited (Boolean)
  - editHistory (List of Maps: [{text, timestamp}], max 5 entries)
  - reactionCount (Number)
  - isDeleted (Boolean, soft delete)
  - itemType (String: "letter" or "media")
  - itemTitle (String, denormalized for profile display)

GSI: UserCommentsIndex
  - PK: userId
  - SK: createdAt
  - Projection: ALL
  - Use case: User profile comment history
```

**CommentReactions Table:**
```
PK: commentId (UUID from Comments table)
SK: userId (Cognito sub)
Attributes:
  - reactionType (String: "like", future: "heart", "thumbs_up")
  - createdAt (ISO timestamp)

No GSI needed for v1 (only query: "get all reactions for comment X")
```

**Messages Table:**
```
PK: conversationId (String)
  - 1-on-1: "{smaller-userId}#{larger-userId}" (consistent ordering)
  - Group: UUID generated when conversation created
SK: messageId (timestamp#uuid)
Attributes:
  - senderId (String)
  - senderName (String, denormalized)
  - messageText (String, max 5000 chars)
  - attachments (List of Maps: [{s3Key, filename, contentType, size}])
  - createdAt (ISO timestamp)
  - conversationType (String: "direct" or "group")
  - participants (StringSet, all user IDs)

No GSI needed (queries always by conversationId)
```

**ConversationMembers Table:**
```
PK: userId (Cognito sub)
SK: conversationId (String)
Attributes:
  - conversationType (String: "direct" or "group")
  - participantIds (StringSet)
  - participantNames (StringSet, denormalized)
  - lastMessageAt (ISO timestamp)
  - unreadCount (Number)
  - conversationTitle (String, optional for groups)

GSI: RecentConversationsIndex
  - PK: userId
  - SK: lastMessageAt (descending)
  - Projection: ALL
  - Use case: Inbox sorted by most recent activity
```

---

## Lambda Function Patterns

### Common Handler Structure

All Lambda functions follow this pattern:

```javascript
// handler.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    // 1. Extract userId from JWT (Cognito authorizer)
    const userId = event.requestContext.authorizer.claims.sub;
    
    // 2. Parse request body
    const body = JSON.parse(event.body);
    
    // 3. Validate inputs
    if (!body.requiredField) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field' })
      };
    }
    
    // 4. Business logic (DynamoDB operations)
    const result = await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: { /* ... */ }
    }));
    
    // 5. Return response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Adjust for production
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

### Error Handling Strategy

**Client Errors (4xx):**
- 400 Bad Request: Invalid input (missing fields, validation failures)
- 401 Unauthorized: Missing/invalid JWT token
- 403 Forbidden: Not in ApprovedUsers group, or accessing private profile
- 404 Not Found: Resource doesn't exist

**Server Errors (5xx):**
- 500 Internal Server Error: Unexpected failures
- 503 Service Unavailable: DynamoDB throttling (retry with exponential backoff)

**Logging:**
- Log all errors with context: `console.error('Operation failed', { userId, itemId, error })`
- CloudWatch Logs retention: 30 days
- Structured JSON logs for easy parsing

---

## API Endpoint Patterns

### Naming Convention

- **Resource-oriented:** `/profile`, `/comments`, `/messages`
- **Plurals for collections:** `/comments/{itemId}` (list), `/profile/{userId}` (get one)
- **Actions as HTTP verbs:** POST (create), GET (read), PUT (update), DELETE (delete)

### Pagination Pattern

For endpoints returning lists:

```
GET /comments/{itemId}?limit=50&lastEvaluatedKey=base64EncodedKey

Response:
{
  "items": [...],
  "lastEvaluatedKey": "base64EncodedKey" // null if no more items
}
```

### Authentication

All endpoints use Cognito authorizer:

```yaml
# API Gateway configuration
Authorizer:
  Type: COGNITO_USER_POOLS
  AuthorizerResultTtlInSeconds: 300
  IdentitySource: method.request.header.Authorization
  ProviderARNs:
    - !GetAtt UserPool.Arn
```

Frontend includes JWT token in requests:

```javascript
fetch('/api/comments/123', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

---

## Frontend Patterns

### SvelteKit Route Structure

```
src/routes/
├── profile/
│   ├── [userId]/
│   │   └── +page.svelte        # User profile page
│   └── settings/
│       └── +page.svelte        # Edit own profile
├── messages/
│   ├── +page.svelte            # Conversation list
│   ├── [conversationId]/
│   │   └── +page.svelte        # Message thread
│   └── new/
│       └── +page.svelte        # Start new conversation
└── {year}/
    └── {slug}/
        └── +page.svelte        # Letter page (add CommentSection component)
```

### Component Organization

```
src/lib/components/
├── comments/
│   ├── CommentSection.svelte   # Container for comment UI
│   ├── Comment.svelte          # Individual comment display
│   └── CommentForm.svelte      # New comment input
├── profile/
│   ├── ProfileCard.svelte      # Main profile display
│   ├── CommentHistory.svelte   # User's comment list
│   └── ActivityStats.svelte    # Stats widget
└── messages/
    ├── ConversationList.svelte # Inbox view
    ├── MessageThread.svelte    # Chat interface
    └── NewConversation.svelte  # Compose new message
```

### API Service Pattern

Create typed API clients:

```typescript
// src/lib/services/commentService.ts
import { getAuthToken } from '$lib/stores/auth';

export async function getComments(itemId: string, limit = 50, lastKey?: string) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ limit: limit.toString() });
  if (lastKey) params.set('lastEvaluatedKey', lastKey);
  
  const response = await fetch(`/api/comments/${itemId}?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error('Failed to fetch comments');
  return response.json();
}

export async function createComment(itemId: string, text: string) {
  const token = await getAuthToken();
  const response = await fetch(`/api/comments/${itemId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ commentText: text })
  });
  
  if (!response.ok) throw new Error('Failed to create comment');
  return response.json();
}
```

---

## Testing Strategy

### Unit Tests

**Backend (Lambda):**
- Test each Lambda handler function independently
- Mock DynamoDB calls using `aws-sdk-client-mock`
- Test error handling (invalid inputs, missing auth, DynamoDB failures)
- Test edge cases (empty strings, very long text, special characters)

**Frontend (Components):**
- Test component rendering (Vitest + Testing Library)
- Test user interactions (button clicks, form submissions)
- Mock API calls
- Test accessibility (ARIA labels, keyboard navigation)

### Integration Tests

**API Tests:**
- Use Postman collections or `supertest` to test API endpoints
- Test full request/response cycle (auth → Lambda → DynamoDB → response)
- Test pagination, filtering, error responses

**End-to-End Tests:**
- Playwright or Cypress for critical user flows
- Test: Login → View letter → Add comment → See comment appear
- Test: Login → View profile → See comment history → Click comment → Navigate to letter

### Test Data

**DynamoDB Local:**
- Use DynamoDB Local for development testing
- Seed test data: 3 users, 5 letters, 20 comments

**Mocked Users:**
- Test user: `testuser@example.com` (Cognito sub: `test-user-123`)
- Admin user: `admin@example.com` (Cognito sub: `admin-user-456`)
- Private profile user: `private@example.com`

---

## Security Checklist

Every feature must satisfy:

- [ ] All endpoints require Cognito authentication
- [ ] ApprovedUsers group membership checked
- [ ] User can only modify their own resources (profiles, comments)
- [ ] Admin role required for moderation actions
- [ ] All inputs validated (type, length, format)
- [ ] HTML sanitized (prevent XSS in comments)
- [ ] SQL injection N/A (DynamoDB not vulnerable)
- [ ] Rate limiting on write operations (10 requests/min per user)
- [ ] CORS configured for specific domain (not wildcard `*`)
- [ ] S3 presigned URLs have short expiry (15 minutes)
- [ ] Private profiles hidden from unauthorized users
- [ ] DMs only visible to conversation participants

---

## Common Pitfalls to Avoid

1. **Forgetting to denormalize data**
   - ❌ Bad: Query UserProfiles table for every comment to get userName
   - ✅ Good: Store userName in Comments table when comment created

2. **Not handling pagination**
   - ❌ Bad: Query returns all 10,000 comments at once
   - ✅ Good: Use `Limit` parameter and `LastEvaluatedKey` for pagination

3. **Ignoring soft deletes**
   - ❌ Bad: Hard delete comments (lose audit trail)
   - ✅ Good: Set `isDeleted: true` flag (soft delete)

4. **Missing error handling**
   - ❌ Bad: Lambda crashes on invalid input
   - ✅ Good: Validate inputs, return 400 Bad Request

5. **Forgetting CORS headers**
   - ❌ Bad: API returns 200 but browser blocks response
   - ✅ Good: Include `Access-Control-Allow-Origin` header

6. **Not testing authentication**
   - ❌ Bad: Assume JWT is always valid
   - ✅ Good: Test with missing token, expired token, non-ApprovedUser

7. **Hardcoding table names**
   - ❌ Bad: `TableName: 'hold-that-thought-comments'`
   - ✅ Good: `TableName: process.env.COMMENTS_TABLE`

8. **Ignoring DynamoDB item size limits**
   - ❌ Bad: Store 1MB comment text in DynamoDB
   - ✅ Good: Limit comment to 2000 chars, store large content in S3

---

## Development Environment Setup

### Local DynamoDB

```bash
# Install DynamoDB Local
docker pull amazon/dynamodb-local

# Run DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Create tables locally
aws dynamodb create-table \
  --table-name hold-that-thought-comments \
  --attribute-definitions AttributeName=itemId,AttributeType=S AttributeName=commentId,AttributeType=S \
  --key-schema AttributeName=itemId,KeyType=HASH AttributeName=commentId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

### Lambda Local Testing

```bash
# Install SAM CLI (for local Lambda testing)
brew install aws-sam-cli

# Test Lambda locally
sam local invoke ProfileApiFunction --event events/get-profile.json
```

### Environment Variables

Create `.env` file:

```
# AWS
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# DynamoDB Tables
USER_PROFILES_TABLE=hold-that-thought-user-profiles
COMMENTS_TABLE=hold-that-thought-comments
REACTIONS_TABLE=hold-that-thought-comment-reactions
MESSAGES_TABLE=hold-that-thought-messages
CONVERSATION_MEMBERS_TABLE=hold-that-thought-conversation-members

# S3
BUCKET_NAME=hold-that-thought-bucket

# SES
SES_FROM_EMAIL=noreply@holdthatthought.family

# Cognito
USER_POOL_ID=us-east-1_ABC123
USER_POOL_CLIENT_ID=abc123xyz

# API Gateway
API_GATEWAY_URL=https://api123.execute-api.us-east-1.amazonaws.com/prod

# Feature Flags
FEATURE_COMMENTS_ENABLED=true
FEATURE_MESSAGING_ENABLED=true
FEATURE_PROFILES_ENABLED=true
```

---

## Commit Message Convention

Use Conventional Commits format:

```
type(scope): brief description

- Detailed change 1
- Detailed change 2

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no behavior change)
- `test`: Add/update tests
- `docs`: Documentation changes
- `chore`: Build/tooling changes
- `style`: Code formatting (no logic change)

**Scopes:**
- `comments`: Comment system changes
- `profile`: Profile features
- `messages`: Messaging system
- `infra`: CloudFormation/infrastructure
- `api`: API Gateway/Lambda changes

**Examples:**

```
feat(comments): add comment creation endpoint

- Create comments-api Lambda function
- Add POST /comments/{itemId} endpoint
- Validate comment text length (max 2000 chars)
- Denormalize user name and photo URL

Estimated tokens: ~5000
```

```
fix(profile): prevent users from viewing private profiles

- Add isProfilePrivate check in profile-api Lambda
- Return 403 Forbidden if not owner/admin
- Add unit tests for privacy logic

Closes #123
```

---

## Next Steps

Proceed to **Phase 1: Backend Foundation** to begin implementation.
