# API Reference

Complete documentation for all Hold That Thought API endpoints.

## Base URL

```
Production: https://api.holdthatthought.family
Staging: https://api-staging.holdthatthought.family
Development: http://localhost:3000
```

## Authentication

All endpoints require JWT authentication via Cognito.

**Header:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Getting a Token:**
1. User logs in via Cognito Hosted UI
2. Frontend receives JWT tokens
3. Frontend stores tokens in localStorage
4. Frontend includes token in all API requests

**Token Claims:**
```json
{
  "sub": "user-123-abc",           // User ID
  "email": "user@example.com",
  "cognito:groups": ["ApprovedUsers"],
  "exp": 1673388000               // Expiration timestamp
}
```

## Common Response Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Not in ApprovedUsers group or not authorized
- `404 Not Found` - Resource doesn't exist
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Comments API

### GET /comments/{itemId}

Get all comments for a letter or media item.

**Parameters:**
- `itemId` (path, required): Letter path (e.g., `/2015/christmas`) or media S3 key
- `limit` (query, optional): Number of comments (default: 50, max: 100)
- `lastEvaluatedKey` (query, optional): Pagination token

**Response 200:**
```json
{
  "items": [
    {
      "commentId": "2025-01-15T10:30:00.000Z#abc-123",
      "itemId": "/2015/christmas",
      "userId": "user-123-abc",
      "userName": "John Doe",
      "userPhotoUrl": "https://s3.amazonaws.com/profile-photos/user-123.jpg",
      "commentText": "Great letter! Brings back memories.",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": null,
      "isEdited": false,
      "reactionCount": 5,
      "isDeleted": false,
      "itemType": "letter",
      "itemTitle": "Christmas 2015"
    }
  ],
  "lastEvaluatedKey": "base64-encoded-token" // null if no more items
}
```

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.holdthatthought.family/comments/2015/christmas?limit=20"
```

---

### POST /comments/{itemId}

Create a new comment.

**Parameters:**
- `itemId` (path, required): Letter path or media S3 key

**Request Body:**
```json
{
  "commentText": "This is my comment",
  "itemType": "letter",              // "letter" or "media"
  "itemTitle": "Christmas 2015"      // Optional
}
```

**Validation:**
- `commentText`: Required, 1-2000 characters
- `itemType`: Required, must be "letter" or "media"

**Response 200:**
```json
{
  "commentId": "2025-01-15T10:30:00.000Z#abc-123",
  "itemId": "/2015/christmas",
  "userId": "user-123-abc",
  "userName": "John Doe",
  "userPhotoUrl": "https://s3.amazonaws.com/...",
  "commentText": "This is my comment",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "reactionCount": 0,
  "isEdited": false,
  "isDeleted": false
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commentText": "Great letter!", "itemType": "letter"}' \
  "https://api.holdthatthought.family/comments/2015/christmas"
```

---

### PUT /comments/{itemId}/{commentId}

Update an existing comment.

**Parameters:**
- `itemId` (path, required): Letter path or media S3 key
- `commentId` (path, required): Comment ID

**Authorization:** User must be comment owner

**Request Body:**
```json
{
  "commentText": "Updated comment text"
}
```

**Response 200:**
```json
{
  "commentId": "2025-01-15T10:30:00.000Z#abc-123",
  "commentText": "Updated comment text",
  "updatedAt": "2025-01-15T11:00:00.000Z",
  "isEdited": true
}
```

---

### DELETE /comments/{itemId}/{commentId}

Delete a comment (soft delete).

**Parameters:**
- `itemId` (path, required)
- `commentId` (path, required)

**Authorization:** User must be comment owner or admin

**Response 200:**
```json
{
  "message": "Comment deleted successfully"
}
```

---

## Reactions API

### POST /reactions/{commentId}

Add a reaction to a comment.

**Parameters:**
- `commentId` (path, required): Comment ID

**Request Body:**
```json
{
  "reactionType": "like"  // Currently only "like" supported
}
```

**Response 200:**
```json
{
  "commentId": "2025-01-15T10:30:00.000Z#abc-123",
  "userId": "user-123-abc",
  "reactionType": "like",
  "createdAt": "2025-01-15T11:00:00.000Z"
}
```

**Note:** Calling this endpoint again with same commentId toggles the reaction (removes it).

---

### GET /reactions/{commentId}

Get all reactions for a comment.

**Parameters:**
- `commentId` (path, required)

**Response 200:**
```json
{
  "reactions": [
    {
      "userId": "user-123-abc",
      "reactionType": "like",
      "createdAt": "2025-01-15T11:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Profile API

### GET /profile/me

Get current user's profile.

**Response 200:**
```json
{
  "userId": "user-123-abc",
  "email": "user@example.com",
  "displayName": "John Doe",
  "profilePhotoUrl": "https://s3.amazonaws.com/...",
  "bio": "Father of two, grandfather of five",
  "familyRelationship": "Father",
  "generation": "Generation 2",
  "familyBranch": "Smith Branch",
  "joinedDate": "2024-01-01T00:00:00.000Z",
  "isProfilePrivate": false,
  "commentCount": 42,
  "mediaUploadCount": 15,
  "lastActive": "2025-01-15T10:00:00.000Z"
}
```

---

### GET /profile/{userId}

Get another user's profile.

**Parameters:**
- `userId` (path, required)

**Authorization:** Public profiles visible to all. Private profiles only visible to owner/admin.

**Response 200:**
```json
{
  "userId": "user-123-abc",
  "displayName": "John Doe",
  "profilePhotoUrl": "https://s3.amazonaws.com/...",
  "bio": "Father of two, grandfather of five",
  "familyRelationship": "Father",
  "commentCount": 42,
  "joinedDate": "2024-01-01T00:00:00.000Z"
}
```

**Response 403:** (if profile is private and user not authorized)
```json
{
  "error": "This profile is private"
}
```

---

### PUT /profile/me

Update current user's profile.

**Request Body:** (all fields optional)
```json
{
  "displayName": "John Smith",
  "bio": "Updated bio",
  "familyRelationship": "Father",
  "isProfilePrivate": false,
  "profilePhotoUrl": "https://s3.amazonaws.com/..."
}
```

**Validation:**
- `displayName`: 1-100 characters
- `bio`: 0-500 characters
- `familyRelationship`: 1-100 characters

**Response 200:**
```json
{
  "userId": "user-123-abc",
  "displayName": "John Smith",
  "bio": "Updated bio",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

---

### GET /profile/{userId}/comments

Get user's comment history.

**Parameters:**
- `userId` (path, required)
- `limit` (query, optional): Default 20, max 100
- `lastEvaluatedKey` (query, optional): Pagination token

**Response 200:**
```json
{
  "comments": [
    {
      "commentId": "2025-01-15T10:30:00.000Z#abc-123",
      "itemId": "/2015/christmas",
      "itemType": "letter",
      "itemTitle": "Christmas 2015",
      "commentText": "Great letter!",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "reactionCount": 5
    }
  ],
  "lastEvaluatedKey": null
}
```

---

## Messages API

### GET /messages/conversations

Get user's conversation list (inbox).

**Response 200:**
```json
{
  "conversations": [
    {
      "conversationId": "user-123-abc#user-456-def",
      "conversationType": "direct",
      "participantIds": ["user-123-abc", "user-456-def"],
      "participantNames": ["John Doe", "Jane Smith"],
      "lastMessageAt": "2025-01-15T10:30:00.000Z",
      "unreadCount": 2
    }
  ]
}
```

---

### GET /messages/{conversationId}

Get messages in a conversation.

**Parameters:**
- `conversationId` (path, required)
- `limit` (query, optional): Default 50, max 100
- `lastEvaluatedKey` (query, optional): Pagination token

**Authorization:** User must be conversation participant

**Response 200:**
```json
{
  "messages": [
    {
      "messageId": "2025-01-15T10:30:00.000Z#abc-123",
      "conversationId": "user-123-abc#user-456-def",
      "senderId": "user-123-abc",
      "senderName": "John Doe",
      "messageText": "Hi there!",
      "attachments": [],
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "lastEvaluatedKey": null
}
```

---

### POST /messages/{conversationId}

Send a message in a conversation.

**Parameters:**
- `conversationId` (path, required)

**Request Body:**
```json
{
  "messageText": "Hello!",
  "attachments": [
    {
      "s3Key": "attachments/abc-123.jpg",
      "filename": "photo.jpg",
      "contentType": "image/jpeg",
      "size": 1024000
    }
  ]
}
```

**Validation:**
- `messageText`: Required, 1-5000 characters
- `attachments`: Optional, max 5 attachments

**Response 200:**
```json
{
  "messageId": "2025-01-15T10:30:00.000Z#abc-123",
  "conversationId": "user-123-abc#user-456-def",
  "senderId": "user-123-abc",
  "messageText": "Hello!",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

---

### POST /messages/conversations

Create a new conversation.

**Request Body:**
```json
{
  "participantIds": ["user-456-def", "user-789-ghi"],
  "conversationType": "group",
  "conversationTitle": "Family Planning",  // Required for groups
  "initialMessage": "Let's discuss plans"  // Optional
}
```

**Validation:**
- `participantIds`: Required, min 1, max 10 participants
- `conversationType`: "direct" or "group"
- `conversationTitle`: Required for groups, 1-100 characters

**Response 200:**
```json
{
  "conversationId": "conv-uuid-123",
  "conversationType": "group",
  "participantIds": ["user-123-abc", "user-456-def", "user-789-ghi"],
  "conversationTitle": "Family Planning",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "details": "Optional additional details"
}
```

**Examples:**

```json
// 400 Bad Request
{
  "error": "Comment text cannot be empty"
}

// 401 Unauthorized
{
  "error": "Missing or invalid authentication token"
}

// 403 Forbidden
{
  "error": "You are not authorized to delete this comment"
}

// 429 Too Many Requests
{
  "error": "Rate limit exceeded. Please try again in 60 seconds"
}

// 500 Internal Server Error
{
  "error": "Internal server error",
  "details": "Please contact support if this persists"
}
```

## Rate Limiting

**Current Limits:**
- **Read endpoints:** No limit
- **Write endpoints:** 10 requests per minute per user

**Response Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1673388000
```

**Exceeding Limits:**
Returns `429 Too Many Requests` with retry time.

## Pagination

All list endpoints support cursor-based pagination:

**Request:**
```
GET /comments/2015/christmas?limit=20&lastEvaluatedKey=base64-token
```

**Response:**
```json
{
  "items": [...],
  "lastEvaluatedKey": "next-page-token"  // null if last page
}
```

**Usage:**
1. Make initial request without `lastEvaluatedKey`
2. If `lastEvaluatedKey` is not null, make another request with it
3. Repeat until `lastEvaluatedKey` is null

## Testing the API

### Using curl

```bash
# Get token (after logging in via frontend)
TOKEN=$(cat ~/.auth-token)

# Get comments
curl -H "Authorization: Bearer $TOKEN" \
  https://api.holdthatthought.family/comments/2015/christmas

# Create comment
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commentText": "Test comment", "itemType": "letter"}' \
  https://api.holdthatthought.family/comments/2015/christmas
```

### Using JavaScript

```javascript
// API client example
async function getComments(itemId) {
  const token = localStorage.getItem('authToken');
  const response = await fetch(
    `https://api.holdthatthought.family/comments/${itemId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
}
```

### Postman Collection

Import the Postman collection from: `docs/postman/HoldThatThought.postman_collection.json`

## Changelog

### v1.0 (2025-01-15)
- Initial release
- Comments API
- Reactions API
- Profile API
- Messages API

### Future Endpoints

- `GET /search` - Full-text search
- `GET /activity-feed` - Recent activity across site
- `POST /admin/moderate` - Admin moderation actions
- `GET /analytics` - Usage analytics
