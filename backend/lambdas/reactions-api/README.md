# Reactions API Lambda Function

Lambda function for adding/removing reactions (likes) on comments in the Hold That Thought application.

## Features

- **POST /reactions/{commentId}** - Toggle reaction (add if absent, remove if present)
- **GET /reactions/{commentId}** - Get all reactions for a comment

## Environment Variables

- `COMMENT_REACTIONS_TABLE` - DynamoDB table name for comment reactions
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

### Idempotent Toggle
The POST endpoint implements a toggle pattern:
- First call: Adds reaction
- Second call: Removes reaction
- Third call: Adds reaction again

This ensures the endpoint is idempotent - calling it multiple times has a predictable result.

### Atomic Counter Updates
When reactions are added/removed, the `reactionCount` field in the Comments table is atomically incremented/decremented using DynamoDB's ADD operation. This prevents race conditions.

## API Reference

### POST /reactions/{commentId}

Toggle a reaction on a comment.

**Path Parameters:**
- `commentId`: The comment ID

**Request Body:**
```json
{
  "itemId": "/2015/christmas-letter",
  "reactionType": "like"
}
```

**Response (Adding):**
```json
{
  "liked": true,
  "message": "Reaction added"
}
```

**Response (Removing):**
```json
{
  "liked": false,
  "message": "Reaction removed"
}
```

### GET /reactions/{commentId}

Get all reactions for a comment.

**Path Parameters:**
- `commentId`: The comment ID

**Response:**
```json
{
  "commentId": "2025-01-15T10:00:00.000Z#abc-123",
  "count": 2,
  "reactions": [
    {
      "userId": "auth0|abc123",
      "reactionType": "like",
      "createdAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "userId": "auth0|def456",
      "reactionType": "like",
      "createdAt": "2025-01-15T11:00:00.000Z"
    }
  ]
}
```

## Error Codes

- `400` - Bad Request (missing commentId or itemId)
- `401` - Unauthorized (missing JWT token)
- `404` - Not Found (invalid route)
- `500` - Internal Server Error

## Design Decisions

### Why Toggle Instead of Separate Add/Remove Endpoints?

1. **Simpler Frontend Logic** - UI can call one endpoint for both actions
2. **Idempotent** - Safe to call multiple times without side effects
3. **Fewer API Endpoints** - Easier to maintain

### Why Store itemId in Request Body?

The CommentReactions table uses `commentId` as partition key and `userId` as sort key. To update the reactionCount in the Comments table, we need both `itemId` (partition key) and `commentId` (sort key). Since `itemId` is not part of the CommentReactions key, we require it in the request body.

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
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/hold-that-thought-comment-reactions-*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-comments-*"
      ]
    }
  ]
}
```
