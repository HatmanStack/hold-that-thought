# Hold That Thought

A family letter-sharing platform built with SvelteKit and AWS serverless infrastructure.

## Features

- **Letter Archive**: Browse and read family letters from 1999-2016
- **Comments & Reactions**: Discuss letters with family members
- **Private Messaging**: Direct messaging between approved users
- **Media Gallery**: Share photos with the family
- **PDF Downloads**: Download original letter scans
- **Search & Tags**: Find letters by content or tags

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
│  comments-api │ messages-api │ profile-api │ reactions-api  │
│  media-upload │ pdf-download │ activity-aggregator          │
│  notification-processor                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        Storage                               │
│     DynamoDB (Users, Comments, Messages, Reactions)         │
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
| `/comments` | GET/POST | List/create comments on letters |
| `/comments/{id}` | PUT/DELETE | Update/delete comment |
| `/reactions` | GET/POST | List/add reactions to comments |
| `/messages` | GET/POST | List/send direct messages |
| `/profile` | GET/PUT | Get/update user profile |
| `/media/upload` | POST | Get presigned URL for uploads |
| `/pdf/{letterPath}` | GET | Download letter PDF |

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
