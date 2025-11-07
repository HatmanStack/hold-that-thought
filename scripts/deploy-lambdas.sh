#!/bin/bash
# Deploy all Lambda functions for Hold That Thought social features

set -e  # Exit on error

BUCKET_NAME="${LAMBDA_BUCKET:-hold-that-thought-lambda-deployments}"
STACK_NAME="${STACK_NAME:-hold-that-thought-lambdas}"
ENV="${ENV:-prod}"

echo "====================================="
echo "Lambda Deployment Script"
echo "====================================="
echo "Bucket: $BUCKET_NAME"
echo "Stack: $STACK_NAME"
echo "Environment: $ENV"
echo ""

# Create S3 bucket if it doesn't exist
if ! aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
    echo "Creating S3 bucket: $BUCKET_NAME"
    aws s3 mb "s3://$BUCKET_NAME"
fi

# Package Node.js Lambda functions
echo "Packaging Node.js Lambda functions..."
for lambda_dir in lambdas/profile-api lambdas/comments-api lambdas/reactions-api lambdas/messages-api; do
    lambda_name=$(basename "$lambda_dir")
    echo "  - Packaging $lambda_name..."

    cd "$lambda_dir"

    # Install production dependencies
    npm install --production --silent

    # Create zip file
    zip -rq "../${lambda_name}.zip" . -x "*.git*" "test/*" "coverage/*" "*.md"

    # Upload to S3
    aws s3 cp "../${lambda_name}.zip" "s3://$BUCKET_NAME/${ENV}/${lambda_name}.zip"

    # Clean up
    rm "../${lambda_name}.zip"

    cd - > /dev/null
done

# Package Python Lambda functions
echo ""
echo "Packaging Python Lambda functions..."
for lambda_dir in lambdas/notification-processor lambdas/activity-aggregator; do
    lambda_name=$(basename "$lambda_dir")
    echo "  - Packaging $lambda_name..."

    cd "$lambda_dir"

    # Create temporary directory for packaging
    mkdir -p package

    # Install dependencies
    if [ -f requirements.txt ]; then
        pip install -r requirements.txt -t package/ --quiet
    fi

    # Copy Lambda function
    cp index.py package/

    # Create zip file
    cd package
    zip -rq "../../${lambda_name}.zip" .
    cd ..

    # Upload to S3
    aws s3 cp "../${lambda_name}.zip" "s3://$BUCKET_NAME/${ENV}/${lambda_name}.zip"

    # Clean up
    rm -rf package
    rm "../${lambda_name}.zip"

    cd - > /dev/null
done

echo ""
echo "====================================="
echo "All Lambda functions packaged and uploaded to S3!"
echo ""
echo "Next steps:"
echo "1. Deploy CloudFormation stack:"
echo "   aws cloudformation deploy \\"
echo "     --stack-name $STACK_NAME \\"
echo "     --template-file cloudformation/lambda-functions.yaml \\"
echo "     --parameter-overrides EnvironmentName=$ENV LambdaBucket=$BUCKET_NAME \\"
echo "     --capabilities CAPABILITY_IAM"
echo ""
echo "2. Deploy API Gateway extensions:"
echo "   aws cloudformation deploy \\"
echo "     --stack-name ${STACK_NAME}-api \\"
echo "     --template-file cloudformation/api-gateway-extensions.yaml \\"
echo "     --parameter-overrides EnvironmentName=$ENV"
echo "====================================="
