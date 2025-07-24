# Hold That Thought - Deployment Guide

This guide covers the complete deployment of the Hold That Thought infrastructure on AWS.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js and npm installed
- CloudFormation permissions for your AWS account

## Infrastructure Overview

The application consists of several AWS components:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cognito       │    │   API Gateway    │    │   S3 Bucket     │
│   User Pool     │◄───┤   + Lambda       │◄───┤   Gallery       │
│   + Groups      │    │   Functions      │    │   Storage       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Components

1. **Authentication Layer**
   - Cognito User Pool for user management
   - ApprovedUsers group for access control
   - JWT token-based authentication

2. **API Layer**
   - API Gateway with Cognito authorizer
   - Lambda functions for business logic
   - CORS-enabled endpoints

3. **Storage Layer**
   - S3 bucket for media files
   - Signed URLs for secure access
   - Automatic thumbnail generation

## Deployment Options

### Option 1: Complete Deployment (Recommended)

Deploy everything at once:

```bash
./scripts/deploy-all-infrastructure.sh [environment] [project-name] [google-client-id] [google-client-secret]
```

Example:
```bash
./scripts/deploy-all-infrastructure.sh prod hold-that-thought
```

### Option 2: Step-by-Step Deployment

#### Step 1: Authentication Infrastructure

```bash
./scripts/deploy-auth-infrastructure.sh [environment] [project-name]
```

This deploys:
- Cognito User Pool
- Basic API Gateway
- ApprovedUsers group
- Example protected endpoints

#### Step 2: Gallery Infrastructure

```bash
./scripts/deploy-gallery-infrastructure.sh [environment] [project-name]
```

This deploys:
- S3 bucket for media storage
- Gallery API Gateway with authentication
- Lambda functions for media access
- Letter download endpoints

# Deployment Order and Parameter Requirements

## Deployment Order
1. Deploy Cognito User Pool (if not already deployed)
2. Deploy S3 bucket (if not already deployed)
3. Deploy PDF Download Lambda stack (`scripts/deploy-pdf-download-lambda.sh`)
4. Deploy Media Upload Lambda stack (`scripts/deploy-media-upload-lambda.sh`)
5. Deploy Lambda Integration API Gateway stack (`scripts/deploy-lambda-integration-api.sh`)

## Parameter Requirements
- ProjectName: Name of the project (default: hold-that-thought)
- Environment: Deployment environment (dev, staging, prod)
- S3BucketName: Name of the S3 bucket for Lambda functions
- Region: AWS region (default: us-west-2)
- UserPoolId: Cognito User Pool ID for API Gateway authorizer

## Post-Deployment Configuration

### 1. Add Users to Cognito

Create users in the Cognito User Pool:

```bash
# Via AWS Console
# Go to Cognito → User Pools → [Your Pool] → Create user

# Or via CLI
aws cognito-idp admin-create-user \
  --user-pool-id [USER_POOL_ID] \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

### 2. Add Users to ApprovedUsers Group

```bash
node scripts/add-approved-user.js user@example.com
```

### 3. Upload Media Files

Upload files to the S3 bucket in the following structure:

```
your-bucket-name/
├── gallery/
│   ├── pictures/          # Family photos (.jpg, .png, .gif)
│   ├── videos/            # Family videos (.mp4, .avi, .mov)
│   ├── documents/         # Family documents (.pdf, .doc, .txt)
│   ├── thumbnails/        # Auto-generated (don't upload here)
│   └── video-thumbnails/  # Auto-generated (don't upload here)
└── letters/               # Original letter PDFs
    └── [letter-path]/
        └── [letter-name].pdf
```

Example upload:
```bash
aws s3 cp family-photo.jpg s3://your-bucket-name/gallery/pictures/
aws s3 cp letter.pdf s3://your-bucket-name/letters/my-letter-path/my-letter-path.pdf
```

## Environment Variables

After deployment, your `.env` file will contain:

```env
# AWS Configuration
PUBLIC_AWS_REGION=us-west-2

# Cognito Configuration
PUBLIC_COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxx
PUBLIC_COGNITO_IDENTITY_POOL_ID=us-west-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Cognito Hosted UI
PUBLIC_COGNITO_HOSTED_UI_URL=https://your-domain.auth.us-west-2.amazoncognito.com
PUBLIC_COGNITO_HOSTED_UI_DOMAIN=your-domain

# API Gateway
PUBLIC_API_GATEWAY_URL=https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/prod

# Gallery Configuration
PUBLIC_GALLERY_S3_BUCKET=your-bucket-name
PUBLIC_GALLERY_API_URL=https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/prod
```

## Testing the Deployment

### 1. Test Authentication

```bash
# Start the development server
npm run dev

# Navigate to http://localhost:5173/auth/login
# Log in with a user from the ApprovedUsers group
```

### 2. Test Gallery Endpoints

```bash
# Get a JWT token from the browser (localStorage.getItem('cognito_id_token'))
TOKEN="your-jwt-token-here"

# Test health endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-api-gateway-url/gallery/health"

# Test pictures endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-api-gateway-url/gallery/pictures"
```

### 3. Test Letter Download

```bash
# Test letter download endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-api-gateway-url/gallery/letters/your-letter-path"
```

## Troubleshooting

### Common Issues

1. **"User is not in the ApprovedUsers group"**
   - Solution: Add user to group with `node scripts/add-approved-user.js user@example.com`

2. **"No authentication tokens available"**
   - Solution: Log in through the application first

3. **"Failed to load pictures/videos/documents"**
   - Check S3 bucket permissions
   - Verify files are uploaded to correct paths
   - Check Lambda function logs in CloudWatch

4. **CORS errors**
   - Verify API Gateway CORS configuration
   - Check that OPTIONS methods are deployed

### Useful Commands

```bash
# Check CloudFormation stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Check Cognito users
aws cognito-idp list-users --user-pool-id [USER_POOL_ID]

# Check S3 bucket contents
aws s3 ls s3://your-bucket-name/gallery/ --recursive

# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/hold-that-thought"
```

## Cleanup

To remove all infrastructure:

```bash
# Delete CloudFormation stacks (in reverse order)
aws cloudformation delete-stack --stack-name hold-that-thought-prod-gallery-api
aws cloudformation delete-stack --stack-name hold-that-thought-prod-gallery-s3
aws cloudformation delete-stack --stack-name hold-that-thought-prod-api
aws cloudformation delete-stack --stack-name hold-that-thought-prod-cognito

# Empty and delete S3 bucket if needed
aws s3 rm s3://your-bucket-name --recursive
```

## Security Considerations

- All API endpoints require JWT authentication
- Users must be in the ApprovedUsers group
- S3 bucket is private with no public access
- Signed URLs expire after 1 hour
- All communication uses HTTPS
- CloudWatch logging enabled for monitoring

## Support

For issues or questions:
1. Check CloudWatch logs for Lambda functions
2. Verify CloudFormation stack status
3. Test individual components in isolation
4. Review AWS IAM permissions