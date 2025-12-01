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
│                   Netlify / S3 + CloudFront                  │
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
- **Backend**: AWS Lambda (Node.js 20.x), API Gateway
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
pnpm test                    # Run all tests (91 tests)
pnpm test tests/unit         # Frontend unit tests only
pnpm test backend/           # Backend tests only
pnpm lint                    # ESLint
pnpm check                   # Svelte type check
```

## Environment Variables

Frontend (`.env`):
```
PUBLIC_AWS_REGION=us-east-1
PUBLIC_API_ENDPOINT=https://api.example.com
PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxx
PUBLIC_S3_BUCKET=hold-that-thought-media
```

## License

Apache License 2.0
