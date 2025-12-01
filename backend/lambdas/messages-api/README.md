# Messages API Lambda Function

Lambda function for direct messaging (1-on-1 and group conversations) in the Hold That Thought application.

## Features

- **GET /messages/conversations** - List user's conversations (sorted by recent activity)
- **GET /messages/conversations/{conversationId}** - Get messages in conversation (paginated)
- **POST /messages/conversations** - Create new conversation (1-on-1 or group)
- **POST /messages/conversations/{conversationId}** - Send message
- **POST /messages/upload** - Generate presigned S3 URL for attachment upload
- **PUT /messages/conversations/{conversationId}/read** - Mark conversation as read (reset unreadCount)

## Environment Variables

- `USER_PROFILES_TABLE` - DynamoDB table name for user profiles
- `MESSAGES_TABLE` - DynamoDB table name for messages
- `CONVERSATION_MEMBERS_TABLE` - DynamoDB table name for conversation members
- `BUCKET_NAME` - S3 bucket name for message attachments

## Installation

```bash
npm install
```

## Testing

```bash
npm test
```

## Key Features

### ConversationId Generation

**1-on-1 Conversations:**
```javascript
conversationId = [userId1, userId2].sort().join('#')
// Example: "user-abc#user-xyz"
```

**Group Conversations:**
```javascript
conversationId = uuid()
// Example: "550e8400-e29b-41d4-a716-446655440000"
```

### Unread Count Management

- **Sender**: unreadCount = 0 (sender doesn't see their own message as unread)
- **Recipients**: unreadCount incremented by 1 for each new message
- **Mark as Read**: resets unreadCount to 0

### Attachment Support

1. Client requests presigned URL: `POST /messages/upload`
2. Client uploads file directly to S3 using presigned URL
3. Client includes S3 key in message: `POST /messages/conversations/{convId}`

## API Reference

See README for full API documentation.

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
        "dynamodb:Query",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/hold-that-thought-messages-*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-conversation-members-*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-conversation-members-*/index/*",
        "arn:aws:dynamodb:*:*:table/hold-that-thought-user-profiles-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::hold-that-thought-bucket/messages/attachments/*"
    }
  ]
}
```
