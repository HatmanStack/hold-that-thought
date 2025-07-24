#!/bin/bash

# Complete Infrastructure Deployment Script
# Usage: ./scripts/deploy-all-infrastructure.sh [environment] [project-name] [google-client-id] [google-client-secret]

set -e

# Default values
ENVIRONMENT=${1:-prod}
PROJECT_NAME=${2:-hold-that-thought}
GOOGLE_CLIENT_ID=${3:-""}
GOOGLE_CLIENT_SECRET=${4:-""}

echo "🚀 Deploying complete Hold That Thought infrastructure..."
echo "Environment: $ENVIRONMENT"
echo "Project: $PROJECT_NAME"
echo ""

# Step 1: Deploy Authentication Infrastructure
echo "🔐 Step 1: Deploying authentication infrastructure..."
if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    ./scripts/deploy-auth-infrastructure.sh $ENVIRONMENT $PROJECT_NAME $GOOGLE_CLIENT_ID $GOOGLE_CLIENT_SECRET
else
    ./scripts/deploy-auth-infrastructure.sh $ENVIRONMENT $PROJECT_NAME
fi

if [ $? -ne 0 ]; then
    echo "❌ Authentication infrastructure deployment failed!"
    exit 1
fi

echo ""
echo "✅ Authentication infrastructure deployed successfully!"
echo ""

# Step 2: Deploy Gallery Infrastructure
echo "🖼️  Step 2: Deploying gallery infrastructure..."
./scripts/deploy-gallery-infrastructure.sh $ENVIRONMENT $PROJECT_NAME

if [ $? -ne 0 ]; then
    echo "❌ Gallery infrastructure deployment failed!"
    exit 1
fi

echo ""
echo "✅ Gallery infrastructure deployed successfully!"
echo ""

# Final Summary
echo "🎉 Complete infrastructure deployment successful!"
echo ""
echo "📋 Deployment Summary:"
echo "====================="
echo "✅ Cognito User Pool - Authentication"
echo "✅ API Gateway - Basic endpoints"
echo "✅ S3 Bucket - Media storage"
echo "✅ Gallery API Gateway - Media access with auth"
echo "✅ Lambda Functions - Gallery operations"
echo ""
echo "🔧 Next Steps:"
echo "============="
echo "1. Add users to Cognito User Pool"
echo "2. Add users to 'ApprovedUsers' group"
echo "3. Upload media files to S3 bucket"
echo "4. Test the application: npm run dev"
echo ""
echo "📁 Important Files:"
echo "=================="
echo "• .env - Environment configuration"
echo "• Check CloudFormation stacks in AWS Console"
echo "• S3 bucket: $(grep PUBLIC_GALLERY_S3_BUCKET .env 2>/dev/null | cut -d'=' -f2 || echo 'Check .env file')"
echo ""
echo "🔗 Useful Commands:"
echo "=================="
echo "• Add user to ApprovedUsers: node scripts/add-approved-user.js <email>"
echo "• Test gallery health: curl -H 'Authorization: Bearer <token>' \$(grep PUBLIC_API_GATEWAY_URL .env | cut -d'=' -f2)/gallery/health"