# System Architecture

## Overview

Hold That Thought is a serverless family letter-sharing application built on AWS. The architecture follows a three-tier pattern: frontend (SvelteKit), API layer (Lambda + API Gateway), and data layer (DynamoDB + S3).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User's Browser                              │
│                     (SvelteKit Application)                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Amazon CloudFront                              │
│                     (CDN + SSL Termination)                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ├──────────────┬──────────────┐
                             ▼              ▼              ▼
                    ┌────────────┐  ┌─────────────┐  ┌──────────────┐
                    │  S3 Bucket │  │API Gateway  │  │   Cognito    │
                    │(Static Web)│  │  (REST API) │  │  User Pool   │
                    └────────────┘  └──────┬──────┘  └──────┬───────┘
                                           │                 │
                                           │ JWT Auth        │
                                           ▼                 │
                                    ┌──────────────┐         │
                                    │   Lambda     │◀────────┘
                                    │  Functions   │
                                    └──────┬───────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
            ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
            │   DynamoDB   │      │  S3 Bucket   │      │     SES      │
            │   Tables     │      │ (Media Files)│      │ (Email Notifications)
            └──────────────┘      └──────────────┘      └──────────────┘
```

## Components

### Frontend Layer

**Technology:** SvelteKit 2.x + TypeScript

**Hosting:** Netlify / Vercel / S3 + CloudFront

**Key Features:**
- Server-side rendering (SSR) for better SEO
- Static generation for blog posts and letters
- Client-side routing for dynamic pages
- TailwindCSS + DaisyUI for styling

**Structure:**
```
src/
├── routes/              # SvelteKit pages
│   ├── +page.svelte    # Home page
│   ├── profile/        # Profile pages
│   ├── messages/       # Messaging UI
│   └── [year]/[slug]/  # Letter pages
├── lib/
│   ├── components/     # Reusable components
│   ├── services/       # API client functions
│   ├── stores/         # Svelte stores (auth, UI state)
│   └── auth/           # Authentication utilities
└── hooks.server.ts     # Server hooks (security headers)
```

### API Layer

**Technology:** AWS API Gateway + Lambda (Node.js)

**Authentication:** Cognito JWT authorizer

**Lambda Functions:**
- `comments-api` - Comment CRUD operations
- `reactions-api` - Like/react to comments
- `messages-api` - Direct messaging
- `profile-api` - User profile management
- `notification-processor` - DynamoDB Streams → SES emails

**API Gateway Configuration:**
- Cognito authorizer on all endpoints
- CORS enabled for frontend domain
- Request validation enabled
- CloudWatch logging enabled

### Data Layer

**DynamoDB Tables:**

1. **UserProfiles**
   - PK: `userId` (Cognito sub)
   - Attributes: displayName, email, bio, profilePhotoUrl, stats
   - GSI: EmailIndex (PK: email)

2. **Comments**
   - PK: `itemId` (letter path or media key)
   - SK: `commentId` (ISO timestamp + UUID)
   - Attributes: userId, userName, commentText, reactionCount, isDeleted
   - GSI: UserCommentsIndex (PK: userId, SK: createdAt)

3. **CommentReactions**
   - PK: `commentId`
   - SK: `userId`
   - Attributes: reactionType, createdAt

4. **Messages**
   - PK: `conversationId`
   - SK: `messageId` (ISO timestamp + UUID)
   - Attributes: senderId, messageText, attachments, participants

5. **ConversationMembers**
   - PK: `userId`
   - SK: `conversationId`
   - Attributes: participantIds, lastMessageAt, unreadCount
   - GSI: RecentConversationsIndex (PK: userId, SK: lastMessageAt DESC)

**S3 Buckets:**
- Media storage (photos, videos, documents)
- Profile photos
- Message attachments
- Original letter PDFs

**Access Pattern:** Presigned URLs with 15-minute expiry

### Authentication Flow

```
1. User clicks "Log In"
   ↓
2. Frontend redirects to Cognito Hosted UI
   ↓
3. User enters credentials
   ↓
4. Cognito validates and returns JWT tokens
   ↓
5. Frontend stores tokens in localStorage
   ↓
6. API requests include JWT in Authorization header
   ↓
7. API Gateway validates JWT via Cognito authorizer
   ↓
8. Lambda extracts userId from validated JWT claims
```

### Notification Flow

```
1. User adds comment → DynamoDB write
   ↓
2. DynamoDB Streams trigger notification-processor Lambda
   ↓
3. Lambda checks notification preferences
   ↓
4. Lambda generates email from template
   ↓
5. Lambda sends via SES
   ↓
6. User receives email notification
```

## Data Flow Examples

### Adding a Comment

```
User → Frontend → API Gateway → comments-api Lambda → DynamoDB Comments table
                                                      ↓
                                        DynamoDB Streams
                                                      ↓
                                     notification-processor Lambda
                                                      ↓
                                                    SES
```

### Viewing Profile

```
User → Frontend → API Gateway → profile-api Lambda → DynamoDB UserProfiles + Comments
                                                      ↓
                                                  Response JSON
```

### Sending Message

```
User → Frontend → API Gateway → messages-api Lambda → DynamoDB Messages + ConversationMembers
                                                      ↓
                                        S3 (if attachment)
                                                      ↓
                                        DynamoDB Streams
                                                      ↓
                                     notification-processor Lambda
```

## Security Architecture

### Defense in Depth

1. **Network Layer:**
   - CloudFront DDoS protection
   - API Gateway throttling (10k req/sec account limit)

2. **Authentication:**
   - Cognito User Pool with MFA support
   - JWT tokens (1 hour expiry)
   - Refresh tokens (30 days)

3. **Authorization:**
   - ApprovedUsers group check in all Lambdas
   - Resource ownership validation (users can only modify their own content)
   - Admin role for moderation

4. **Data Protection:**
   - DynamoDB encryption at rest (KMS)
   - S3 bucket encryption
   - HTTPS everywhere (no HTTP allowed)
   - CSP headers prevent XSS

5. **Application Layer:**
   - Input validation on client and server
   - SQL injection N/A (DynamoDB)
   - Rate limiting (planned)

## Scalability

### Current Scale

- **Users:** 50 family members
- **Requests:** ~1000/day
- **Storage:** ~10GB media files
- **Cost:** $15-25/month

### Scaling Strategy

**To 500 users:**
- DynamoDB PAY_PER_REQUEST scales automatically
- Lambda scales to 1000 concurrent executions
- S3 unlimited storage
- **Estimated cost:** $50-75/month

**To 5000 users:**
- Consider DynamoDB provisioned capacity
- Enable DAX caching for read-heavy tables
- Implement CloudFront caching
- **Estimated cost:** $200-300/month

### Bottleneck Analysis

**Potential bottlenecks:**
- Lambda cold starts (mitigate: provisioned concurrency)
- DynamoDB hot partitions (mitigate: better partition key design)
- SES sending limits (mitigate: request limit increase)

## Monitoring & Observability

### CloudWatch Metrics

- Lambda: Invocations, Errors, Duration, Throttles
- DynamoDB: ConsumedCapacity, UserErrors, Throttles
- API Gateway: Count, 4XXError, 5XXError, Latency
- SES: Send, Bounce, Complaint

### CloudWatch Logs

- All Lambda function logs (7-day retention)
- API Gateway access logs
- CloudTrail for audit logs

### CloudWatch Alarms

- Lambda error rate > 1%
- API Gateway 5XX errors > 10/5min
- DynamoDB throttling events
- SES bounce rate > 5%

### X-Ray (Optional)

- Distributed tracing for request flows
- Performance bottleneck identification

## Disaster Recovery

### Backup Strategy

**DynamoDB:**
- Point-in-time recovery enabled (35-day retention)
- Daily backups to S3 via AWS Backup

**S3:**
- Versioning enabled
- Cross-region replication (optional)

**Lambda:**
- Code versioning
- Deployment packages archived in S3

### RTO/RPO Targets

- **RPO (Recovery Point Objective):** 1 hour
- **RTO (Recovery Time Objective):** 4 hours

### Rollback Procedure

1. Disable feature flags (immediate)
2. Revert Lambda function versions (5 minutes)
3. Revert CloudFormation stacks (15 minutes)
4. Restore DynamoDB from backup (if needed, 1 hour)

## Development Workflow

### Environments

- **Development:** Local (DynamoDB Local, mocked AWS services)
- **Staging:** AWS account with test data
- **Production:** AWS account with real data

### CI/CD Pipeline

```
Git Push → GitHub Actions → Run Tests → Build → Deploy to Staging → Manual Approval → Deploy to Production
```

### Testing Strategy

- **Unit Tests:** Jest for Lambda functions
- **Integration Tests:** Test API endpoints with real AWS services
- **E2E Tests:** Playwright for full user flows
- **Load Tests:** Artillery for performance testing

## Technology Decisions

### Why Serverless?

- **Pros:** No server management, auto-scaling, pay-per-use
- **Cons:** Cold starts, vendor lock-in, debugging complexity

**Decision:** Serverless fits the low-traffic, variable-load pattern of a family app.

### Why DynamoDB over RDS?

- **Pros:** No cold starts, PAY_PER_REQUEST billing, auto-scaling
- **Cons:** Limited query patterns, no joins, learning curve

**Decision:** DynamoDB is more cost-effective for this use case ($10/mo vs $20+/mo for RDS).

### Why SvelteKit over Next.js?

- **Pros:** Smaller bundle size, simpler reactivity, better performance
- **Cons:** Smaller ecosystem, fewer tutorials

**Decision:** Performance and simplicity outweigh ecosystem size for this project.

## Future Enhancements

- **Real-time messaging:** WebSockets via API Gateway
- **Full-text search:** OpenSearch or Algolia integration
- **Analytics:** Custom CloudWatch metrics + QuickSight dashboards
- **Mobile app:** React Native sharing same API
- **Offline support:** Service workers + local storage

## References

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
