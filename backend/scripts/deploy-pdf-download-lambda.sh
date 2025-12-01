#!/bin/bash
# Deploy the PDF Download Lambda stack
aws cloudformation deploy \
  --template-file ../aws-infrastructure/pdf-download-lambda.yaml \
  --stack-name hold-that-thought-pdf-download-lambda \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ProjectName=hold-that-thought Environment=prod S3BucketName=hold-that-thought-bucket Region=us-west-2
