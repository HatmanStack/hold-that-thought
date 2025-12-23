# Hold That Thought

Family letter-sharing platform. SvelteKit + AWS serverless.

## Documentation Index

| Document | Contents |
|----------|----------|
| [API_REFERENCE.md](./API_REFERENCE.md) | All API endpoints with signatures, parameters, responses |
| [DATA_MODEL.md](./DATA_MODEL.md) | DynamoDB schema, key patterns, entity schemas |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | AWS deployment, Cognito setup, troubleshooting |
| [DOC_STYLE_GUIDE.md](./DOC_STYLE_GUIDE.md) | Documentation standards |

## Architecture

```
Frontend (SvelteKit) → S3 + CloudFront
           ↓
API Gateway + Cognito Auth
           ↓
Lambda Functions:
  - ApiFunction (routes)
  - LetterProcessorFunction (PDF processing)
  - ActivityAggregatorFunction (DynamoDB stream)
  - NotificationProcessorFunction (email)
           ↓
Storage:
  - DynamoDB (single-table)
  - S3 (letters, media, profiles)
  - SES (notifications)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit 2.x, TypeScript, TailwindCSS, DaisyUI |
| Backend | AWS Lambda (Node.js 24.x), API Gateway |
| Database | DynamoDB (single-table design) |
| Storage | S3, CloudFront |
| Auth | Amazon Cognito (Google OAuth, Email/Password) |
| IaC | AWS SAM |
| Testing | Vitest |

## Commands

```bash
npm install && cd frontend && npm install  # Install
npm run deploy                              # Deploy backend
npm run dev                                 # Start dev server
npm test                                    # Run tests
npm run lint                                # ESLint + types
npm run check                               # All checks
npm run dead-code                           # Find unused code
./scripts/doc-audit.sh                      # Audit documentation
```

## Environment

Copy `.env.example` to `.env`. Deploy script auto-populates API URLs.

Required for auth:
```
PUBLIC_AWS_REGION
PUBLIC_COGNITO_USER_POOL_ID
PUBLIC_COGNITO_USER_POOL_CLIENT_ID
PUBLIC_COGNITO_IDENTITY_POOL_ID
PUBLIC_COGNITO_HOSTED_UI_URL
PUBLIC_COGNITO_HOSTED_UI_DOMAIN
```

Without Cognito config: read-only mode (gallery only).

## License

Apache License 2.0
