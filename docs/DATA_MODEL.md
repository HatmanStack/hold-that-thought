# Data Model

## DynamoDB Single-Table Design

**Table:** `HoldThatThought` (configurable via `TABLE_NAME`)

### Key Patterns

| Entity | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| User Profile | `USER#{userId}` | `PROFILE` | - | - |
| User Conversation | `USER#{userId}` | `CONV#{convId}` | - | - |
| Rate Limit | `USER#{userId}` | `RATE#{action}` | - | - |
| Comment | `COMMENT#{itemId}` | `{timestamp}#{commentId}` | `USER#{userId}` | `COMMENT#{timestamp}` |
| Reaction | `COMMENT#{itemId}` | `REACTION#{commentId}#{userId}` | `USER#{userId}` | `REACTION#{timestamp}` |
| Conversation Meta | `CONV#{convId}` | `META` | - | - |
| Message | `CONV#{convId}` | `MSG#{timestamp}#{msgId}` | - | - |
| Letter | `LETTER#{date}` | `CURRENT` | `LETTERS` | `{date}` |
| Letter Version | `LETTER#{date}` | `VERSION#{timestamp}` | - | - |
| Draft | `DRAFT#{draftId}` | `METADATA` | - | - |

### Prefixes

```javascript
{
  USER: 'USER#',
  COMMENT: 'COMMENT#',
  CONV: 'CONV#',
  MSG: 'MSG#',
  REACTION: 'REACTION#',
  RATE: 'RATE#',
  LETTER: 'LETTER#',
  VERSION: 'VERSION#',
  DRAFT: 'DRAFT#'
}
```

### Access Patterns

| Pattern | Query | Index |
|---------|-------|-------|
| Get user profile | PK = `USER#{userId}`, SK = `PROFILE` | Table |
| List user conversations | PK = `USER#{userId}`, SK begins_with `CONV#` | Table |
| List comments on item | PK = `COMMENT#{itemId}`, SK begins_with `{timestamp}` | Table |
| Get user's comments | GSI1PK = `USER#{userId}`, GSI1SK begins_with `COMMENT#` | GSI1 |
| Get user's reactions | GSI1PK = `USER#{userId}`, GSI1SK begins_with `REACTION#` | GSI1 |
| List all letters | GSI1PK = `LETTERS`, GSI1SK descending | GSI1 |
| Get letter versions | PK = `LETTER#{date}`, SK begins_with `VERSION#` | Table |
| Get conversation messages | PK = `CONV#{convId}`, SK begins_with `MSG#` | Table |

---

## S3 Bucket Structure

**Bucket:** Configurable via `ARCHIVE_BUCKET`

| Prefix | Purpose | Access |
|--------|---------|--------|
| `letters/` | Letter PDFs and metadata | Public read via presigned URLs |
| `media/pictures/` | User-uploaded images | Presigned URLs |
| `media/videos/` | User-uploaded videos | Presigned URLs |
| `media/documents/` | User-uploaded PDFs | Presigned URLs |
| `profile-photos/` | User profile images | Presigned URLs |
| `temp/` | Temporary upload staging | Short TTL |
| `messages/` | Message attachments | Presigned URLs |

---

## Entity Schemas

### User Profile
```typescript
{
  PK: string           // USER#{userId}
  SK: 'PROFILE'
  userId: string
  email: string
  displayName: string
  bio?: string
  photoUrl?: string
  familyRelationship?: string
  generation?: string
  familyBranch?: string
  isProfilePrivate: boolean
  contactEmail?: string
  notifyOnMessage: boolean
  notifyOnComment: boolean
  theme?: string
  familyRelationships?: object
  mediaUploadCount: number
  status: 'active' | 'inactive' | 'deleted'  // listUsers filters non-active
  groups: string[]
  createdAt: string    // ISO8601
  updatedAt: string    // ISO8601
}
```

### Comment
```typescript
{
  PK: string           // COMMENT#{itemId}
  SK: string           // {timestamp}#{commentId}
  GSI1PK: string       // USER#{userId}
  GSI1SK: string       // COMMENT#{timestamp}
  itemId: string
  commentId: string
  userId: string
  userName: string
  userPhotoUrl?: string
  commentText: string
  itemType?: string
  itemTitle?: string
  reactionCount: number
  createdAt: string
  updatedAt?: string
}
```

### Reaction
```typescript
{
  PK: string           // COMMENT#{itemId}
  SK: string           // REACTION#{commentId}#{userId}
  GSI1PK: string       // USER#{userId}
  GSI1SK: string       // REACTION#{timestamp}
  itemId: string
  commentId: string
  userId: string
  userName: string
  reactionType: string
  createdAt: string
}
```

### Conversation Meta
```typescript
{
  PK: string           // CONV#{convId}
  SK: 'META'
  conversationId: string
  conversationType: string
  conversationTitle?: string
  creatorId: string
  participantIds: string[]
  createdAt: string
  lastMessageAt: string
}
```

### Conversation Member
```typescript
{
  PK: string           // USER#{userId}
  SK: string           // CONV#{convId}
  conversationId: string
  conversationType: string
  conversationTitle?: string
  lastReadAt?: string
  unreadCount: number
  lastMessageAt: string
}
```

### Message
```typescript
{
  PK: string           // CONV#{convId}
  SK: string           // MSG#{timestamp}#{msgId}
  messageId: string
  conversationId: string
  senderId: string
  senderName: string
  messageText: string
  attachments?: {
    s3Key: string
    fileName: string
    contentType: string
  }[]
  createdAt: string
}
```

### Letter
```typescript
{
  PK: string           // LETTER#{date}
  SK: 'CURRENT'
  GSI1PK: 'LETTERS'
  GSI1SK: string       // date (YYYY-MM-DD)
  date: string
  title: string
  author?: string
  content: string      // markdown
  description?: string
  versionCount: number
  createdAt: string
  updatedAt: string
  updatedBy: string
}
```

### Letter Version
```typescript
{
  PK: string           // LETTER#{date}
  SK: string           // VERSION#{timestamp}
  date: string
  title: string
  author?: string
  content: string
  description?: string
  timestamp: string
  updatedBy: string
}
```

### Draft
```typescript
{
  PK: string           // DRAFT#{draftId}
  SK: 'METADATA'
  draftId: string
  status: 'pending' | 'processing' | 'ready' | 'published' | 'failed'
  uploaderId: string
  fileKeys: string[]
  extractedData?: {
    date?: string
    title?: string
    author?: string
    content?: string
  }
  errorMessage?: string
  createdAt: string
  updatedAt: string
}
```

### Rate Limit
```typescript
{
  PK: string           // USER#{userId}
  SK: string           // RATE#{action}
  count: number
  windowStart: number  // epoch ms
  TTL: number          // epoch seconds for DynamoDB TTL
}
```
