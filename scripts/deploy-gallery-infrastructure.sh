#!/bin/bash

# Gallery Infrastructure Deployment Script
# Usage: ./scripts/deploy-gallery-infrastructure.sh [environment] [project-name]

set -e

# Default values
ENVIRONMENT=${1:-prod}
PROJECT_NAME=${2:-hold-that-thought}
AWS_REGION=${AWS_REGION:-us-west-2}

echo "🖼️  Deploying gallery infrastructure..."
echo "Environment: $ENVIRONMENT"
echo "Project: $PROJECT_NAME"
echo "Region: $AWS_REGION"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if Cognito stack exists (prerequisite)
COGNITO_STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-cognito"
if ! aws cloudformation describe-stacks --stack-name $COGNITO_STACK_NAME --region $AWS_REGION > /dev/null 2>&1; then
    echo "❌ Cognito stack not found. Please run deploy-auth-infrastructure.sh first."
    exit 1
fi

# Get Cognito User Pool ARN (required for gallery API)
echo "📋 Getting Cognito User Pool information..."
USER_POOL_ARN=$(aws cloudformation describe-stacks \
    --stack-name $COGNITO_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolArn`].OutputValue' \
    --output text \
    --region $AWS_REGION)

if [ -z "$USER_POOL_ARN" ]; then
    echo "❌ Could not retrieve User Pool ARN from Cognito stack."
    exit 1
fi

# Deploy S3 Gallery Bucket
echo "🪣 Deploying S3 Gallery Bucket..."
S3_STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-gallery-s3"

aws cloudformation deploy \
    --template-file aws-infrastructure/s3-gallery-bucket.yaml \
    --stack-name $S3_STACK_NAME \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $AWS_REGION

# Get S3 bucket name
echo "📋 Getting S3 bucket information..."
S3_BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name $S3_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
    --output text \
    --region $AWS_REGION)

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "❌ Could not retrieve S3 bucket name."
    exit 1
fi

# Deploy Gallery API Gateway
echo "🌐 Deploying Gallery API Gateway..."
GALLERY_API_STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-gallery-api"

aws cloudformation deploy \
    --template-file aws-infrastructure/gallery-api-gateway.yaml \
    --stack-name $GALLERY_API_STACK_NAME \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        UserPoolArn=$USER_POOL_ARN \
        S3BucketName=$S3_BUCKET_NAME \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $AWS_REGION

# Get Gallery API Gateway URL
echo "📋 Getting Gallery API Gateway information..."
GALLERY_API_URL=$(aws cloudformation describe-stacks \
    --stack-name $GALLERY_API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text \
    --region $AWS_REGION)

PICTURES_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $GALLERY_API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`PicturesEndpoint`].OutputValue' \
    --output text \
    --region $AWS_REGION)

VIDEOS_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $GALLERY_API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`VideosEndpoint`].OutputValue' \
    --output text \
    --region $AWS_REGION)

DOCUMENTS_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $GALLERY_API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`DocumentsEndpoint`].OutputValue' \
    --output text \
    --region $AWS_REGION)

LETTER_DOWNLOAD_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $GALLERY_API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`LetterDownloadEndpoint`].OutputValue' \
    --output text \
    --region $AWS_REGION)

HEALTH_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $GALLERY_API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`HealthEndpoint`].OutputValue' \
    --output text \
    --region $AWS_REGION)

# Update .env file with gallery endpoints
echo "📝 Updating .env file with gallery configuration..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run deploy-auth-infrastructure.sh first."
    exit 1
fi

# Add gallery configuration to .env (or update if exists)
if grep -q "# Gallery Configuration" .env; then
    echo "⚠️  Gallery configuration already exists in .env, skipping..."
else
    cat >> .env << EOF

# Gallery Configuration
PUBLIC_GALLERY_S3_BUCKET=$S3_BUCKET_NAME
PUBLIC_GALLERY_API_URL=$GALLERY_API_URL
EOF
fi

echo "✅ Gallery deployment completed successfully!"
echo ""
echo "📋 Gallery Configuration Summary:"
echo "================================"
echo "S3 Bucket: $S3_BUCKET_NAME"
echo "Gallery API URL: $GALLERY_API_URL"
echo "Pictures Endpoint: $PICTURES_ENDPOINT"
echo "Videos Endpoint: $VIDEOS_ENDPOINT"
echo "Documents Endpoint: $DOCUMENTS_ENDPOINT"
echo "Letter Download Endpoint: $LETTER_DOWNLOAD_ENDPOINT"
echo "Health Check Endpoint: $HEALTH_ENDPOINT"
echo ""
echo "🔧 Next Steps:"
echo "============="
echo "1. Upload media files to S3 bucket structure:"
echo "   • gallery/pictures/ - for family photos"
echo "   • gallery/videos/ - for family videos"
echo "   • gallery/documents/ - for family documents"
echo "   • letters/ - for original letter PDFs"
echo ""
echo "2. Test gallery endpoints:"
echo "   • Health: curl -H 'Authorization: Bearer <token>' $HEALTH_ENDPOINT"
echo "   • Pictures: curl -H 'Authorization: Bearer <token>' $PICTURES_ENDPOINT"
echo ""
echo "3. Add users to ApprovedUsers group in Cognito"
echo ""
echo "📁 S3 Bucket Structure:"
echo "======================"
echo "$S3_BUCKET_NAME/"
echo "├── gallery/"
echo "│   ├── pictures/          # Family photos"
echo "│   ├── videos/            # Family videos"
echo "│   ├── documents/         # Family documents"
echo "│   ├── thumbnails/        # Auto-generated thumbnails"
echo "│   └── video-thumbnails/  # Auto-generated video thumbnails"
echo "└── letters/               # Original letter PDFs"
echo "    └── {letter-path}/"
echo "        └── {letter-name}.pdf"
echo ""
echo "🔐 Security Notes:"
echo "================="
echo "• All endpoints require Cognito JWT authentication"
echo "• Users must be in 'ApprovedUsers' group"
echo "• S3 bucket is private - access only via signed URLs"
echo "• Signed URLs expire after 1 hour"