# Deployment Guide

## Prerequisites

- **Node.js** v24 LTS (via nvm)
- **npm** (included with Node.js)
- **AWS CLI** configured with credentials
- **AWS SAM CLI** for serverless deployment

## Quick Deploy

```bash
# Backend (Lambda + API Gateway + DynamoDB)
cd backend && sam build && sam deploy --guided

# Frontend (after backend is deployed)
npm run build
netlify deploy --prod  # or your preferred host
```

## Backend Deployment

### First-time Setup

```bash
cd backend
sam build
sam deploy --guided
```

SAM will prompt for:
- Stack name (e.g., `hold-that-thought-prod`)
- AWS Region
- Cognito User Pool ID
- S3 bucket name for media

Configuration is saved to `samconfig.toml` for subsequent deploys.

### Subsequent Deploys

```bash
cd backend && sam build && sam deploy
```

### Environment-specific Deploys

```bash
# Development
sam deploy --config-env dev

# Production
sam deploy --config-env prod
```

## Frontend Deployment

### Build

```bash
npm run build
```

### Deploy to Netlify

```bash
netlify deploy --prod --dir=build
```

Or connect your repo to Netlify for automatic deploys on push.

### Environment Variables

Set these in your hosting platform:

| Variable | Description |
|----------|-------------|
| `PUBLIC_AWS_REGION` | AWS region (e.g., `us-east-1`) |
| `PUBLIC_API_ENDPOINT` | API Gateway URL |
| `PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Cognito App Client ID |
| `PUBLIC_S3_BUCKET` | S3 bucket for media |

## Infrastructure Components

### Created by SAM Deploy

- **API Gateway** - REST API with Cognito authorizer
- **Lambda Functions** - 9 functions for API endpoints
- **DynamoDB Tables** - UserProfiles, Comments, Messages, Reactions
- **S3 Bucket** - Media storage with presigned URL access
- **Cognito User Pool** - Authentication with Google OAuth
- **SES** - Email notifications (requires verification)

### Manual Setup Required

1. **Cognito Google OAuth** - Add Google as identity provider
2. **SES Email Verification** - Verify sender email address
3. **CloudFront** (optional) - CDN for S3 media

## Cognito Setup

### Add Google OAuth

1. Go to Cognito Console → User Pool → Sign-in experience
2. Add identity provider → Google
3. Enter Google Client ID and Secret
4. Map attributes: `email`, `name`, `picture`

### Create ApprovedUsers Group

```bash
aws cognito-idp create-group \
  --user-pool-id YOUR_POOL_ID \
  --group-name ApprovedUsers
```

### Add User to Approved Group

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_POOL_ID \
  --username USER_EMAIL \
  --group-name ApprovedUsers
```

## Troubleshooting

### Lambda Timeout

Increase timeout in `template.yaml`:
```yaml
Globals:
  Function:
    Timeout: 30
```

### CORS Errors

Check API Gateway CORS settings and `AllowedOrigins` in template.yaml.

### Auth Failures

1. Verify Cognito User Pool ID and Client ID
2. Check user is in ApprovedUsers group
3. Verify JWT token is being sent in Authorization header

### DynamoDB Errors

Check Lambda execution role has DynamoDB permissions.
