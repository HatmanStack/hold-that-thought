#!/bin/bash

# Deploy Lambda Integration API Gateway Stack
# This script deploys the new API Gateway with Cognito authorizer for Lambda function integrations

set -e

# Configuration
STACK_NAME="hold-that-thought-lambda-integration-api"
TEMPLATE_FILE="../aws-infrastructure/lambda-integration-api-gateway.yaml"
REGION="us-west-2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying Lambda Integration API Gateway Stack...${NC}"
echo "Stack Name: $STACK_NAME"
echo "Template: $TEMPLATE_FILE"
echo "Region: $REGION"
echo ""

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}Error: Template file $TEMPLATE_FILE not found!${NC}"
    exit 1
fi

# Validate CloudFormation template
echo -e "${YELLOW}Validating CloudFormation template...${NC}"
aws cloudformation validate-template \
    --template-body file://$TEMPLATE_FILE \
    --region $REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Template validation successful!${NC}"
else
    echo -e "${RED}Template validation failed!${NC}"
    exit 1
fi

# Deploy the stack
echo -e "${YELLOW}Deploying CloudFormation stack...${NC}"
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        ProjectName=hold-that-thought \
        Environment=prod \
        UserPoolId=us-west-2_X8J2UR7BF \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Stack deployment successful!${NC}"
    
    # Get stack outputs
    echo -e "${YELLOW}Stack Outputs:${NC}"
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
        
    echo ""
    echo -e "${GREEN}Lambda Integration API Gateway deployed successfully!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Deploy PDF download Lambda function"
    echo "2. Deploy media upload Lambda function"
    echo "3. Update API Gateway methods to integrate with Lambda functions"
    
else
    echo -e "${RED}Stack deployment failed!${NC}"
    exit 1
fi