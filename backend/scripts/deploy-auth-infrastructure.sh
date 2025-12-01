#!/bin/bash

# AWS Cognito and API Gateway Infrastructure Deployment Script
# Usage: ./scripts/deploy-auth-infrastructure.sh [environment] [project-name]

set -e

# Default values
ENVIRONMENT=${1:-dev}
PROJECT_NAME=${2:-sveltekit-auth}
AWS_REGION=${AWS_REGION:-us-east-1}
GOOGLE_CLIENT_ID=${3:-""}
GOOGLE_CLIENT_SECRET=${4:-""}

echo "🚀 Deploying authentication infrastructure..."
echo "Environment: $ENVIRONMENT"
echo "Project: $PROJECT_NAME"
echo "Region: $AWS_REGION"

if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    echo "Google OAuth: Enabled"
else
    echo "Google OAuth: Disabled (can be configured later)"
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Deploy Cognito User Pool
echo "📦 Deploying Cognito User Pool..."
COGNITO_STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-cognito"

COGNITO_PARAMS="ProjectName=$PROJECT_NAME Environment=$ENVIRONMENT"

if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    COGNITO_PARAMS="$COGNITO_PARAMS GoogleClientId=$GOOGLE_CLIENT_ID GoogleClientSecret=$GOOGLE_CLIENT_SECRET"
fi

aws cloudformation deploy \
    --template-file aws-infrastructure/cognito-user-pool.yaml \
    --stack-name $COGNITO_STACK_NAME \
    --parameter-overrides $COGNITO_PARAMS \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $AWS_REGION

# Get Cognito outputs
echo "📋 Getting Cognito User Pool information..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name $COGNITO_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text \
    --region $AWS_REGION)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name $COGNITO_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text \
    --region $AWS_REGION)

IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name $COGNITO_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`IdentityPoolId`].OutputValue' \
    --output text \
    --region $AWS_REGION)

USER_POOL_ARN=$(aws cloudformation describe-stacks \
    --stack-name $COGNITO_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolArn`].OutputValue' \
    --output text \
    --region $AWS_REGION)

USER_POOL_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name $COGNITO_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolDomain`].OutputValue' \
    --output text \
    --region $AWS_REGION)

HOSTED_UI_URL=$(aws cloudformation describe-stacks \
    --stack-name $COGNITO_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`HostedUIUrl`].OutputValue' \
    --output text \
    --region $AWS_REGION)

# Deploy API Gateway with Auth
echo "🌐 Deploying API Gateway with Cognito Authorization..."
API_STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-api"

aws cloudformation deploy \
    --template-file aws-infrastructure/api-gateway-with-auth.yaml \
    --stack-name $API_STACK_NAME \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        UserPoolArn=$USER_POOL_ARN \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $AWS_REGION

# Get API Gateway URL
echo "📋 Getting API Gateway information..."
API_GATEWAY_URL=$(aws cloudformation describe-stacks \
    --stack-name $API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text \
    --region $AWS_REGION)

EXAMPLE_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ExampleEndpoint`].OutputValue' \
    --output text \
    --region $AWS_REGION)

# Create .env file
echo "📝 Creating .env file..."
cat > .env << EOF
# AWS Configuration
PUBLIC_AWS_REGION=$AWS_REGION

# Cognito Configuration
PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
PUBLIC_COGNITO_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
PUBLIC_COGNITO_IDENTITY_POOL_ID=$IDENTITY_POOL_ID

# Cognito Hosted UI
PUBLIC_COGNITO_HOSTED_UI_URL=$HOSTED_UI_URL
PUBLIC_COGNITO_HOSTED_UI_DOMAIN=$USER_POOL_DOMAIN

# API Gateway
PUBLIC_API_GATEWAY_URL=$API_GATEWAY_URL
EOF

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "========================"
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "Identity Pool ID: $IDENTITY_POOL_ID"
echo "Hosted UI URL: $HOSTED_UI_URL"
echo "User Pool Domain: $USER_POOL_DOMAIN"
echo "API Gateway URL: $API_GATEWAY_URL"
echo "Example Endpoint: $EXAMPLE_ENDPOINT"
echo ""
echo "🔐 Authentication Options:"
echo "========================="
if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    echo "✅ Google OAuth: Enabled"
    echo "✅ Hosted UI: Available"
    echo "✅ Manual Users: Can be added via AWS Console"
else
    echo "⚠️  Google OAuth: Not configured (add credentials to enable)"
    echo "✅ Hosted UI: Available"
    echo "✅ Manual Users: Can be added via AWS Console"
fi
echo ""
echo "🔧 Next Steps:"
echo "============="
echo "1. Install dependencies: npm install"
echo "2. Start development server: npm run dev"
echo "3. Authorize users (REQUIRED - no self-registration):"
echo "   • Add users via AWS Console → Cognito → User Pools → Create user"
echo "   • OR configure Google OAuth for approved domains"
echo "4. Test authentication: http://localhost:5173/auth/login"
echo "5. Test protected API: http://localhost:5173/dashboard"
echo ""
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "🔑 To Enable Google OAuth:"
    echo "========================="
    echo "1. Go to Google Cloud Console → APIs & Services → Credentials"
    echo "2. Create OAuth 2.0 Client ID"
    echo "3. Add authorized redirect URIs:"
    echo "   • http://localhost:5173/auth/callback"
    echo "   • https://your-domain.com/auth/callback"
    echo "4. Redeploy with: ./scripts/deploy-auth-infrastructure.sh $ENVIRONMENT $PROJECT_NAME [CLIENT_ID] [CLIENT_SECRET]"
    echo ""
fi
echo "👥 To Add Manual Users:"
echo "======================"
echo "1. Go to AWS Console → Cognito → User Pools → $USER_POOL_ID"
echo "2. Click 'Create user'"
echo "3. Enter email and temporary password"
echo "4. User can sign in with email/password option"
echo ""
echo "📄 Environment variables have been saved to .env file"
echo ""
echo "🖼️  Gallery Infrastructure:"
echo "=========================="
echo "To deploy the gallery infrastructure, run:"
echo "  ./scripts/deploy-gallery-infrastructure.sh $ENVIRONMENT $PROJECT_NAME"
echo ""
echo "This will deploy:"
echo "• S3 bucket for media storage"
echo "• Gallery API Gateway with authentication"
echo "• Lambda functions for media access"
echo "• Letter download endpoints"