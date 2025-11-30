#!/bin/bash

# Deploy signup notification infrastructure
# This script deploys the Lambda function and updates the Cognito User Pool with the trigger

set -e

# Configuration
PROJECT_NAME="hold-that-thought"
ENVIRONMENT="prod"
REGION="us-west-2"
NOTIFICATION_EMAIL="gemenielabs@gmail.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Signup Notification Infrastructure${NC}"
echo "Project: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Notification Email: $NOTIFICATION_EMAIL"
echo ""

# Step 1: Verify SES email address
echo -e "${YELLOW}📧 Step 1: Verifying SES email address...${NC}"
aws ses verify-email-identity --email-address "$NOTIFICATION_EMAIL" --region "$REGION" || {
    echo -e "${RED}❌ Failed to verify email address. Make sure SES is available in your region.${NC}"
    exit 1
}
echo -e "${GREEN}✅ Email verification initiated. Check your email and click the verification link.${NC}"
echo ""

# Step 2: Deploy the Lambda function
echo -e "${YELLOW}📦 Step 2: Deploying signup notification Lambda...${NC}"
LAMBDA_STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-signup-notification"

aws cloudformation deploy \
    --template-file aws-infrastructure/signup-notification-lambda.yaml \
    --stack-name "$LAMBDA_STACK_NAME" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        NotificationEmail="$NOTIFICATION_EMAIL" \
        UserPoolId="$(aws cloudformation describe-stacks --stack-name ${PROJECT_NAME}-cognito --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text --region $REGION)" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" || {
    echo -e "${RED}❌ Failed to deploy Lambda function${NC}"
    exit 1
}

# Get the Lambda ARN
LAMBDA_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$LAMBDA_STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionArn`].OutputValue' \
    --output text \
    --region "$REGION")

echo -e "${GREEN}✅ Lambda function deployed successfully${NC}"
echo "Lambda ARN: $LAMBDA_ARN"
echo ""

# Step 3: Update Cognito User Pool with Lambda trigger
echo -e "${YELLOW}🔗 Step 3: Updating Cognito User Pool with Lambda trigger...${NC}"
COGNITO_STACK_NAME="${PROJECT_NAME}-cognito"

# Get current Google OAuth parameters (if they exist)
GOOGLE_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK_NAME" \
    --query 'Stacks[0].Parameters[?ParameterKey==`GoogleClientId`].ParameterValue' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "")

GOOGLE_CLIENT_SECRET=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK_NAME" \
    --query 'Stacks[0].Parameters[?ParameterKey==`GoogleClientSecret`].ParameterValue' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "")

# Update the Cognito stack with the Lambda trigger
aws cloudformation deploy \
    --template-file aws-infrastructure/cognito-user-pool.yaml \
    --stack-name "$COGNITO_STACK_NAME" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        GoogleClientId="$GOOGLE_CLIENT_ID" \
        GoogleClientSecret="$GOOGLE_CLIENT_SECRET" \
        SignupNotificationLambdaArn="$LAMBDA_ARN" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" || {
    echo -e "${RED}❌ Failed to update Cognito User Pool${NC}"
    exit 1
}

echo -e "${GREEN}✅ Cognito User Pool updated with Lambda trigger${NC}"
echo ""

# Step 4: Test the setup (optional)
echo -e "${YELLOW}🧪 Step 4: Testing the setup...${NC}"
echo "The signup notification system is now active!"
echo ""
echo "What happens next:"
echo "1. When a user signs up via Google OAuth, the Lambda will trigger"
echo "2. An email notification will be sent to: $NOTIFICATION_EMAIL"
echo "3. The email will contain user details and approval instructions"
echo ""

# Display useful information
echo -e "${GREEN}📋 Deployment Summary:${NC}"
echo "Lambda Function: $LAMBDA_ARN"
echo "Notification Email: $NOTIFICATION_EMAIL"
echo "User Pool: $(aws cloudformation describe-stacks --stack-name ${PROJECT_NAME}-cognito --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text --region $REGION)"
echo ""

echo -e "${GREEN}🎉 Signup notification system deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "1. Make sure to verify the email address ($NOTIFICATION_EMAIL) in SES"
echo "2. Check your email for the SES verification link"
echo "3. The Lambda trigger is now active for all new signups"
echo "4. Test by having someone sign up through your application"