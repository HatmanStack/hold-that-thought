# Comments API Lambda Function

Lambda function for comment CRUD operations on letters and media in the Hold That Thought application.

## Features

- **GET /comments/{itemId}** - List comments for letter/media (paginated)
- **POST /comments/{itemId}** - Create new comment with HTML sanitization
- **PUT /comments/{itemId}/{commentId}** - Edit own comment (tracks edit history)
- **DELETE /comments/{itemId}/{commentId}** - Soft delete own comment
- **DELETE /admin/comments/{commentId}** - Admin moderation endpoint

## Environment Variables

- `USER_PROFILES_TABLE` - DynamoDB table name for user profiles
- `COMMENTS_TABLE` - DynamoDB table name for comments

## Installation

```bash
npm install
```

## Testing

Run unit tests:
```bash
npm test
```

## Key Features

### HTML Sanitization
All comment text is sanitized to remove HTML tags and prevent XSS attacks:
```javascript
// Input:  "<script>alert('xss')</script>Hello <b>world</b>!"
// Output: "Hello world!"
```

### Denormalization
User profile data (displayName, profilePhotoUrl) is copied into comments for performance. This creates intentional data staleness - if a user changes their name, old comments show the historical name.

### Edit History
When editing comments, the previous version is saved (max 5 edits tracked):
```json
{
  "editHistory": [
    {
      "text": "Original comment text",
      "timestamp": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

### Soft Delete
Deleted comments are marked as `isDeleted: true` rather than removed from the database. This preserves audit trails and allows for potential recovery.

## API Reference

### GET /comments/{itemId}

List comments for a letter or media item.

**Query Parameters:**
- `limit` (optional): Number of comments to return (default: 50)
- `lastEvaluatedKey` (optional): Pagination token (base64)

**Response:**
```json
{
  "items": [
    {
      "itemId": "/2015/christmas-letter",
      "commentId": "2025-01-15T10:00:00.000Z#abc-123",
      "userId": "auth0|abc123",
      "userName": "John Doe",
      "userPhotoUrl": "https://...",
      "commentText": "Great letter!",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": null,
      "isEdited": false,
      "reactionCount": 5,
      "itemType": "letter",
      "itemTitle": "Christmas Letter 2015"
    }
  ],
  "lastEvaluatedKey": "base64token" // null if no more
}
```

### POST /comments/{itemId}

Create a new comment.

**Request Body:**
```json
{
  "commentText": "This is a great letter!",
  "itemType": "letter",
  "itemTitle": "Christmas Letter 2015"
}
```

**Validation:**
- `commentText`: Required, max 2000 characters after HTML sanitization
- HTML tags are stripped automatically
- Empty comments (after sanitization) are rejected

**Response:** Returns created comment (201 Created)

### PUT /comments/{itemId}/{commentId}

Edit a comment. Only the comment author can edit (admins can edit any comment).

**Request Body:**
```json
{
  "commentText": "Updated comment text"
}
```

**Edit History:** Previous versions are stored in `editHistory` array (max 5).

**Response:** Returns updated comment

### DELETE /comments/{itemId}/{commentId}

Soft delete a comment. Only the comment author can delete (admins can delete any comment).

**Response:**
```json
{
  "message": "Comment deleted successfully"
}
```

### DELETE /admin/comments/{commentId}

Admin-only endpoint to delete any comment.

**Request Body:**
```json
{
  "itemId": "/2015/christmas-letter"
}
```

**Authorization:** Requires user to be in "Admins" Cognito group.

**Response:**
```json
{
  "message": "Comment deleted by admin"
}
```

## Error Codes

- `400` - Bad Request (validation errors, missing fields, text too long)
- `401` - Unauthorized (missing JWT token)
- `403` - Forbidden (editing/deleting others' comments without admin)
- `404` - Not Found (comment doesn't exist)
- `500` - Internal Server Error

## Security Features

1. **HTML Sanitization** - Prevents XSS attacks
2. **Authorization Checks** - Users can only modify their own comments (unless admin)
3. **Input Validation** - Text length limits enforced
4. **Soft Deletes** - Maintains audit trail

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/hold-that-thought-comments-*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-user-profiles-*"
      ]
    }
  ]
}
```
