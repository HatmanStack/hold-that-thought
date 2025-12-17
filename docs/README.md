# Hold That Thought

A family letter-sharing platform built with SvelteKit and AWS serverless infrastructure.

## Features

- **Chat with Archive**: Ask questions about letters, photos, documents, and ancestry records
- **Letter Archive**: Browse and read family letters with AI-powered transcription
- **Comments & Reactions**: Discuss letters with family members
- **Private Messaging**: Direct messaging between approved users
- **Family Directory**: View family member profiles
- **Media Gallery**: Share photos and documents with the family
- **PDF Downloads**: Download original letter scans

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                      │
│                      S3 + CloudFront                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  API Gateway + Cognito Auth                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Lambda Functions                          │
│  ApiFunction (monolith handling all API routes)             │
│  LetterProcessorFunction (PDF/letter processing)            │
│  ActivityAggregatorFunction (DynamoDB stream)               │
│  NotificationProcessorFunction (email notifications)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        Storage                               │
│     DynamoDB (single-table design for all data)             │
│     S3 (Letters, Media, Profile Photos)                     │
│     SES (Email Notifications)                                │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: SvelteKit 2.x, TypeScript, TailwindCSS, DaisyUI
- **Backend**: AWS Lambda (Node.js 24.x), API Gateway
- **Database**: DynamoDB
- **Storage**: S3, CloudFront CDN
- **Auth**: Amazon Cognito (Google OAuth + Email/Password)
- **IaC**: AWS SAM
- **Testing**: Vitest

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/comments/{itemId}` | GET/POST | List/create comments on a letter |
| `/comments/{itemId}/{commentId}` | PUT/DELETE | Update/delete comment |
| `/reactions/{commentId}` | GET/POST/DELETE | Get/add/remove reactions |
| `/messages/conversations` | GET/POST | List conversations / start new |
| `/messages/{conversationId}` | GET/POST/DELETE | Get/send messages / delete conversation |
| `/profile/{userId}` | GET | Get user profile |
| `/profile` | PUT | Update own profile |
| `/users` | GET | List family members |
| `/letters` | GET | List all letters |
| `/letters/{date}` | GET/PUT | Get/update letter content |
| `/letters/{date}/pdf` | GET | Download letter PDF |
| `/media/upload-url` | POST | Get presigned URL for media uploads |
| `/contact` | POST | Send contact form message |

## Testing

```bash
npm test                     # Run unit tests
npm run lint                 # ESLint + type check
npm run check                # Run all checks (lint + tests)
```

## Quick Start

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Copy environment template
cp .env.example .env

# Deploy backend (creates S3 bucket, deploys Lambdas, updates .env)
npm run deploy

# Start dev server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env`. The deploy script auto-populates API Gateway URLs.

**Required for authentication** (Cognito):
```bash
PUBLIC_AWS_REGION=us-west-2
PUBLIC_COGNITO_USER_POOL_ID=us-west-2_ABC123xyz
PUBLIC_COGNITO_USER_POOL_CLIENT_ID=1abc2def3ghi4jkl5mno
PUBLIC_COGNITO_IDENTITY_POOL_ID=us-west-2:12345678-1234-1234-1234-123456789012
PUBLIC_COGNITO_HOSTED_UI_URL=https://your-app.auth.us-west-2.amazoncognito.com
PUBLIC_COGNITO_HOSTED_UI_DOMAIN=your-app
```

**Auto-populated by deploy script**:
```bash
PUBLIC_API_GATEWAY_URL=https://abc123.execute-api.us-west-2.amazonaws.com/Prod/
```

> **Note**: Without valid Cognito configuration, the app runs in read-only mode (gallery browsing only). See [DEPLOYMENT.md](./DEPLOYMENT.md) for Cognito setup instructions.

## License

Apache License 2.0
