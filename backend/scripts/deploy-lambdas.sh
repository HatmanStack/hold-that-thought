#!/bin/bash
set -e

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

if ! aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
    echo "Creating S3 bucket: $BUCKET_NAME"
    aws s3 mb "s3://$BUCKET_NAME"
fi

echo "Packaging Lambda functions..."
for lambda_dir in lambdas/profile-api lambdas/comments-api lambdas/reactions-api lambdas/messages-api lambdas/notification-processor lambdas/activity-aggregator; do
    lambda_name=$(basename "$lambda_dir")
    echo "  - Packaging $lambda_name..."

    cd "$lambda_dir"

    npm install --production --silent

    zip -rq "../${lambda_name}.zip" . -x "*.git*" "test/*" "coverage/*" "*.md" "*.test.js"

    aws s3 cp "../${lambda_name}.zip" "s3://$BUCKET_NAME/${ENV}/${lambda_name}.zip"

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
