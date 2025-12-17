# Deployment Guide

## Prerequisites

- **Node.js** v24 LTS (via nvm)
- **npm** (included with Node.js)
- **AWS CLI** configured with credentials
- **AWS SAM CLI** for serverless deployment

## Project Structure

This is a monorepo with npm workspaces:

```text
├── frontend/          # SvelteKit app (has own package.json)
├── backend/           # AWS SAM application
│   ├── lambdas/       # Lambda function code
│   ├── scripts/       # Deployment scripts
│   └── template.yaml  # SAM template
├── tests/             # Centralized tests
└── package.json       # Root orchestration
```

## Quick Deploy

```bash
# From repository root:

# Backend (Lambda + API Gateway + DynamoDB)
npm run deploy

# Frontend (build for production)
npm run build
```

## Backend Deployment

### Deploy (First-time or Subsequent)

```bash
npm run deploy
```

The deploy script will:
1. Prompt for configuration (region, stack name, OAuth credentials, etc.)
2. Save configuration to `backend/.env.deploy` for future runs
3. Generate `samconfig.toml` automatically
4. Build and deploy the SAM application
5. Update frontend `.env` with stack outputs

**Note:** Do not use `sam deploy --guided`. The deploy script handles all configuration interactively and keeps everything in sync.

## Frontend Deployment

### Install Dependencies

```bash
# From repository root
npm install              # Root dependencies
cd frontend && npm install  # Frontend dependencies
```

### Build

```bash
# From repository root
npm run build
```

Output is in `frontend/build/`.

### Deploy Frontend

The built frontend in `frontend/build/` can be deployed to any static hosting provider (S3 + CloudFront, Vercel, etc.).

### Environment Variables

The deploy script automatically copies `.env` to `frontend/.env` for Vite.

Required variables (set in `.env` or hosting platform):

| Variable | Description |
|----------|-------------|
| `PUBLIC_AWS_REGION` | AWS region (e.g., `us-west-2`) |
| `PUBLIC_API_GATEWAY_URL` | API Gateway URL (auto-populated by deploy) |
| `PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Cognito App Client ID |
| `PUBLIC_COGNITO_IDENTITY_POOL_ID` | Cognito Identity Pool ID |
| `PUBLIC_COGNITO_HOSTED_UI_URL` | Cognito Hosted UI URL (for OAuth) |
| `PUBLIC_COGNITO_HOSTED_UI_DOMAIN` | Cognito domain prefix |

## Infrastructure Components

### Created by SAM Deploy

- **API Gateway** - REST API with Cognito authorizer
- **Lambda Functions** - ApiFunction, LetterProcessorFunction, ActivityAggregatorFunction, NotificationProcessorFunction
- **DynamoDB Table** - Single-table design for all data
- **Cognito User Pool** - User authentication with Identity Pool and domain

### Required Parameters (existing resources)

- **S3 Buckets** - Archive bucket, photo bucket, media bucket (must exist before deploy)

### Manual Setup Required

1. **Cognito Google OAuth** - Add Google as identity provider in Cognito console
2. **SES Email Verification** - Verify sender email address for notifications
3. **CloudFront** (optional) - CDN for S3 media

## Cognito Setup

### Add Google OAuth

1. Go to Cognito Console → User Pool → Sign-in experience
2. Add identity provider → Google
3. Enter Google Client ID and Secret
4. Map attributes: `email`, `name`, `picture`

### Create Groups

```bash
# ApprovedUsers - can comment, message, react
aws cognito-idp create-group \
  --user-pool-id YOUR_POOL_ID \
  --group-name ApprovedUsers

# Admins - full access including moderation
aws cognito-idp create-group \
  --user-pool-id YOUR_POOL_ID \
  --group-name Admins
```

### Add User to Group

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_POOL_ID \
  --username USER_EMAIL \
  --group-name ApprovedUsers
```

## Development Workflow

```bash
# Start dev server (from root)
npm run dev

# Run tests
npm test

# Run all checks (lint + tests)
npm run check

# Frontend-specific commands
cd frontend
npm run check:lint    # ESLint
npm run check:types   # Svelte type check
npm run lint:fix      # Auto-fix lint issues
```

## Troubleshooting

### Lambda Timeout

Increase timeout in `backend/template.yaml`:
```yaml
Globals:
  Function:
    Timeout: 30
```

### CORS Errors

Check API Gateway CORS settings and `AllowedOrigins` parameter in template.yaml.

### Auth Failures

1. Verify Cognito User Pool ID and Client ID in `.env`
2. Check user is in ApprovedUsers group
3. Verify JWT token is being sent in Authorization header

### DynamoDB Errors

Check Lambda execution role has DynamoDB permissions for the table.

### Build Failures

```bash
# Clear caches and reinstall
rm -rf node_modules frontend/node_modules
rm package-lock.json frontend/package-lock.json
npm install
cd frontend && npm install
```
