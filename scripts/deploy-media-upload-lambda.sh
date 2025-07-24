#!/bin/bash
# Deploy the Media Upload Lambda stack
aws cloudformation deploy \
  --template-file ../aws-infrastructure/media-upload-lambda.yaml \
  --stack-name hold-that-thought-media-upload-lambda \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ProjectName=hold-that-thought Environment=prod S3BucketName=hold-that-thought-bucket Region=us-west-2
