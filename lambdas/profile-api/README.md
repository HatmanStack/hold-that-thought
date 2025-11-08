# Profile API Lambda Function

Lambda function for user profile CRUD operations in the Hold That Thought application.

## Features

- **GET /profile/{userId}** - Retrieve user profile with privacy checks
- **PUT /profile** - Update own profile (self-service)
- **GET /profile/{userId}/comments** - Get user's comment history with pagination

## Environment Variables

- `USER_PROFILES_TABLE` - DynamoDB table name for user profiles
- `COMMENTS_TABLE` - DynamoDB table name for comments

## Installation

```bash
pnpm install
```

## Testing

Run unit tests:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test:watch
```

## Manual Testing

Test locally with sample events:
```bash
export USER_PROFILES_TABLE=hold-that-thought-user-profiles-prod
export COMMENTS_TABLE=hold-that-thought-comments-prod

node -e "require('./index').handler(require('./test/events/get-profile.json'), {}).then(console.log)"
```

## API Reference

### GET /profile/{userId}

Retrieve a user's profile.

**Privacy Rules:**
- Public profiles: Anyone can view
- Private profiles: Only owner and admins can view

**Response:**
```json
{
  "userId": "auth0|abc123",
  "email": "user@example.com",
  "displayName": "John Doe",
  "profilePhotoUrl": "https://...",
  "bio": "Family historian",
  "familyRelationship": "Son of Jane Doe",
  "generation": "2nd",
  "familyBranch": "Main",
  "isProfilePrivate": false,
  "commentCount": 15,
  "mediaUploadCount": 3,
  "lastActive": "2025-01-15T10:00:00.000Z",
  "joinedDate": "2024-01-01T00:00:00.000Z"
}
```

### PUT /profile

Update own profile. Users can only update their own profile.

**Request Body:**
```json
{
  "displayName": "John Doe",
  "bio": "Family historian and letter enthusiast",
  "familyRelationship": "Son of Jane Doe",
  "generation": "2nd",
  "familyBranch": "Main",
  "profilePhotoUrl": "https://s3.../photo.jpg",
  "isProfilePrivate": false
}
```

**Validation:**
- `bio`: Max 500 characters
- `displayName`: Max 100 characters
- `familyRelationship`: Max 100 characters

**Response:** Returns updated profile

### GET /profile/{userId}/comments

Get user's comment history with pagination.

**Query Parameters:**
- `limit` (optional): Number of comments to return (default: 50)
- `lastEvaluatedKey` (optional): Base64-encoded pagination token

**Response:**
```json
{
  "items": [
    {
      "itemId": "/2015/christmas-letter",
      "commentId": "2025-01-15T10:00:00.000Z#abc-123",
      "userId": "auth0|abc123",
      "userName": "John Doe",
      "commentText": "Great letter!",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "itemTitle": "Christmas Letter 2015"
    }
  ],
  "lastEvaluatedKey": "base64token" // null if no more items
}
```

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing JWT token)
- `403` - Forbidden (private profile, not owner/admin)
- `404` - Not Found (profile doesn't exist)
- `500` - Internal Server Error

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
        "arn:aws:dynamodb:*:*:table/hold-that-thought-user-profiles-*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-user-profiles-*/index/*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-comments-*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-comments-*/index/*"
      ]
    }
  ]
}
```
