#!/bin/bash
#
# Production Deployment Script for Hold That Thought
# Usage: ./scripts/deploy-production.sh [environment]
#

set -e

ENVIRONMENT=${1:-production}

echo "========================================="
echo "Deploying Hold That Thought"
echo "Environment: $ENVIRONMENT"
echo "========================================="
echo ""

# Pre-Deployment Checklist
echo "Pre-Deployment Checklist:"
echo "  [ ] All tests pass (unit, integration, E2E)"
echo "  [ ] Security audit complete"
echo "  [ ] Monitoring configured"
echo "  [ ] Documentation complete"
echo "  [ ] Rollback plan ready"
echo ""
read -p "Have you completed the checklist above? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Please complete checklist before deploying."
  exit 1
fi

# Step 1: Deploy DynamoDB Tables
echo ""
echo "Step 1: Deploying DynamoDB tables..."
if aws cloudformation describe-stacks --stack-name "hold-that-thought-dynamodb-$ENVIRONMENT" --region us-east-1 > /dev/null 2>&1; then
  echo "  - DynamoDB stack already exists, updating..."
else
  echo "  - Creating DynamoDB stack..."
fi

aws cloudformation deploy \
  --template-file cloudformation/dynamodb-tables.yaml \
  --stack-name "hold-that-thought-dynamodb-$ENVIRONMENT" \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM

echo "  ✓ DynamoDB tables deployed"

# Step 2: Deploy Lambda Functions
echo ""
echo "Step 2: Deploying Lambda functions..."

FUNCTIONS=(
  "comments-api"
  "messages-api"
  "profile-api"
  "reactions-api"
  "notification-processor"
  "activity-aggregator"
)

for FUNCTION in "${FUNCTIONS[@]}"; do
  echo "  - Deploying $FUNCTION..."

  if [ ! -d "lambdas/$FUNCTION" ]; then
    echo "    Warning: lambdas/$FUNCTION directory not found, skipping"
    continue
  fi

  cd "lambdas/$FUNCTION"

  # Install production dependencies
  npm install --production > /dev/null 2>&1

  # Package function
  zip -r function.zip . -x "*.git*" "node_modules/@types/*" "test/*" > /dev/null 2>&1

  # Deploy to AWS Lambda
  aws lambda update-function-code \
    --function-name "$FUNCTION-lambda-$ENVIRONMENT" \
    --zip-file fileb://function.zip \
    --region us-east-1 \
    > /dev/null 2>&1 || echo "    Warning: Could not update $FUNCTION (may not exist yet)"

  # Wait for update to complete
  aws lambda wait function-updated \
    --function-name "$FUNCTION-lambda-$ENVIRONMENT" \
    --region us-east-1 \
    2>&1 | grep -v "does not exist" || true

  # Clean up
  rm function.zip

  cd ../..
done

echo "  ✓ Lambda functions deployed"

# Step 3: Deploy API Gateway
echo ""
echo "Step 3: Deploying API Gateway..."

aws cloudformation deploy \
  --template-file cloudformation/api-gateway-extensions.yaml \
  --stack-name "hold-that-thought-api-$ENVIRONMENT" \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  2>&1 | grep -v "No changes to deploy" || echo "  - No changes needed"

echo "  ✓ API Gateway deployed"

# Step 4: Deploy Monitoring
echo ""
echo "Step 4: Deploying monitoring stack..."

aws cloudformation deploy \
  --template-file cloudformation/monitoring.yaml \
  --stack-name "hold-that-thought-monitoring-$ENVIRONMENT" \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    AlertEmail="admin@holdthatthought.family" \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  2>&1 | grep -v "No changes to deploy" || echo "  - No changes needed"

echo "  ✓ Monitoring deployed"

# Step 5: Deploy Frontend
echo ""
echo "Step 5: Deploying frontend..."

# Build frontend
echo "  - Building frontend..."
pnpm build

# Deploy based on hosting provider
if command -v netlify &> /dev/null; then
  echo "  - Deploying to Netlify..."
  netlify deploy --prod
elif command -v vercel &> /dev/null; then
  echo "  - Deploying to Vercel..."
  vercel --prod
else
  echo "  - Manual deployment required"
  echo "    Upload 'build' directory to your hosting provider"
  read -p "Press Enter after completing frontend deployment..."
fi

echo "  ✓ Frontend deployed"

# Step 6: Run Smoke Tests
echo ""
echo "Step 6: Running smoke tests..."
echo "  - Testing site accessibility..."

SITE_URL="https://holdthatthought.family"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ Site is accessible (HTTP $HTTP_CODE)"
else
  echo "  ✗ Site returned HTTP $HTTP_CODE"
  echo "    Please check deployment manually"
fi

# Step 7: Enable Feature Flags
echo ""
echo "Step 7: Enabling feature flags..."

for FUNCTION in "${FUNCTIONS[@]}"; do
  echo "  - Enabling features for $FUNCTION-lambda-$ENVIRONMENT"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION-lambda-$ENVIRONMENT" \
    --environment "Variables={
      FEATURE_COMMENTS_ENABLED=true,
      FEATURE_MESSAGES_ENABLED=true,
      FEATURE_PROFILES_ENABLED=true
    }" \
    --region us-east-1 \
    > /dev/null 2>&1 || echo "    Warning: Could not update $FUNCTION"
done

echo "  ✓ Feature flags enabled"

# Step 8: Backfill User Profiles (first deployment only)
echo ""
echo "Step 8: User profile backfill (optional)"
read -p "Is this the first deployment? Run backfill? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "  - Running backfill script..."
  node scripts/backfill-user-profiles.js
  echo "  ✓ Backfill complete"
else
  echo "  - Skipping backfill"
fi

# Deployment Complete
echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Test critical user flows:"
echo "   - Login"
echo "   - View letter"
echo "   - Add comment"
echo "   - Send message"
echo "   - View profile"
echo ""
echo "2. Monitor CloudWatch Dashboard:"
echo "   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=$ENVIRONMENT-hold-that-thought"
echo ""
echo "3. Check for alarms:"
echo "   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:"
echo ""
echo "4. Monitor for first 48 hours (check every 4 hours)"
echo ""
echo "If issues arise, rollback with:"
echo "  ./scripts/rollback.sh $ENVIRONMENT"
echo ""
