# Media Upload System Setup Guide

This document explains how to deploy and configure the secure media upload system for the Hold That Thought gallery.

## 🏗️ Architecture Overview

The media upload system uses a secure, serverless architecture:

```
Frontend Upload → API Gateway → Lambda Function → S3 Bucket
                           ↓
                    Cognito JWT Auth
                           ↓
                 ApprovedUsers Check
```

### Security Components:
- **Frontend**: Secure file validation and progress tracking
- **API Gateway**: Cognito JWT authorizer validates tokens
- **Lambda Function**: Processes uploads with user validation
- **S3 Storage**: Encrypted storage with metadata tracking
- **IAM Roles**: Least-privilege access for Lambda function

## 🚀 Deployment Steps

### 1. Prerequisites

Ensure you have already deployed:
- Cognito User Pool (from `cognito-user-pool.yaml`)
- S3 Gallery Bucket (from `s3-gallery-bucket.yaml`)
- Gallery API Gateway (from `gallery-api-gateway.yaml`)

### 2. Deploy Upload Lambda Function

```bash
cd aws-infrastructure

# Get required parameters from existing stacks
USER_POOL_ARN=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolArn`].OutputValue' \
  --output text)

S3_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-gallery \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

API_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-gallery-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text)

AUTHORIZER_ID=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-gallery-api \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoAuthorizerId`].OutputValue' \
  --output text)

# Deploy the upload Lambda function
aws cloudformation deploy \
  --template-file gallery-upload-lambda.yaml \
  --stack-name hold-that-thought-upload \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=hold-that-thought \
    Environment=prod \
    UserPoolArn=$USER_POOL_ARN \
    S3BucketName=$S3_BUCKET_NAME \
    ExistingApiGatewayId=$API_GATEWAY_ID \
    ExistingAuthorizerId=$AUTHORIZER_ID
```

### 3. Update API Gateway Deployment

After adding the upload endpoint, redeploy the API Gateway:

```bash
# Redeploy the API Gateway to include the new upload endpoint
aws apigateway create-deployment \
  --rest-api-id $API_GATEWAY_ID \
  --stage-name prod \
  --description "Added media upload endpoint"
```

### 4. Get Upload Endpoint URL

```bash
# Get the upload endpoint URL
UPLOAD_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-upload \
  --query 'Stacks[0].Outputs[?OutputKey==`UploadEndpoint`].OutputValue' \
  --output text)

echo "Upload Endpoint: $UPLOAD_ENDPOINT"
```

### 5. Update S3 Bucket Structure

Create the required folder structure in your S3 bucket:

```bash
# Create media folders
aws s3api put-object --bucket $S3_BUCKET_NAME --key media/
aws s3api put-object --bucket $S3_BUCKET_NAME --key media/pictures/
aws s3api put-object --bucket $S3_BUCKET_NAME --key media/videos/
aws s3api put-object --bucket $S3_BUCKET_NAME --key media/documents/
```

## 📁 File Organization

### S3 Bucket Structure
```
hold-that-thought-bucket/
├── gallery/                    # Existing gallery files (read-only)
│   ├── pictures/
│   ├── videos/
│   ├── documents/
│   └── thumbnails/
└── media/                      # New upload destination
    ├── pictures/               # User-uploaded images
    ├── videos/                 # User-uploaded videos
    └── documents/              # User-uploaded documents
```

### File Naming Convention
- **Original filename preserved** in S3 metadata
- **Unique S3 key**: `{uuid}_{original_filename}`
- **Automatic categorization** based on file type
- **User metadata** stored with each file

## 🔐 Security Features

### Authentication & Authorization
1. **JWT Token Validation**: API Gateway validates Cognito tokens
2. **ApprovedUsers Check**: Lambda verifies group membership
3. **User Metadata**: Each upload tagged with user information
4. **Audit Trail**: CloudWatch logs track all upload activity

### File Validation
- **File Size Limits**: 50MB for images/documents, 500MB for videos
- **File Type Validation**: Only approved extensions and MIME types
- **Content Scanning**: Basic validation of file headers
- **Malicious File Prevention**: Extension and content type matching

### Storage Security
- **Server-Side Encryption**: AES-256 encryption for all uploads
- **Private Bucket**: No public access, all access via signed URLs
- **IAM Roles**: Lambda uses least-privilege access
- **Metadata Protection**: User information encrypted with file

## 🎨 Frontend Integration

### Using the MediaUpload Component

```svelte
<script>
  import MediaUpload from '$lib/components/MediaUpload.svelte'

  function handleUploadComplete(event) {
    const { results } = event.detail
    console.log('Upload completed:', results)

    // Refresh gallery or show success message
    refreshGallery()
  }

  function handleUploadError(event) {
    const { error } = event.detail
    console.error('Upload error:', error)

    // Show error message to user
    showErrorMessage(error)
  }
</script>

<MediaUpload
  allowMultiple={true}
  acceptedTypes={['pictures', 'videos', 'documents']}
  maxFiles={10}
  on:uploadComplete={handleUploadComplete}
  on:uploadError={handleUploadError}
/>
```

### Upload Service Usage

```typescript
import { uploadMediaFile, validateFile } from '$lib/services/media-upload-service'

// Single file upload with progress
const result = await uploadMediaFile(file, (progress) => {
  console.log(`Upload progress: ${progress.percentage}%`)
})

if (result.success) {
  console.log('File uploaded:', result.data)
}
else {
  console.error('Upload failed:', result.message)
}
```

## 📊 Monitoring & Logging

### CloudWatch Logs
- **Lambda Function**: `/aws/lambda/hold-that-thought-prod-media-upload`
- **API Gateway**: Automatic logging of requests and responses
- **S3 Events**: Object creation and modification events

### Key Metrics to Monitor
- **Upload Success Rate**: Percentage of successful uploads
- **File Size Distribution**: Average and peak file sizes
- **User Activity**: Upload frequency by user
- **Error Rates**: Failed uploads and error types
- **Storage Usage**: S3 bucket growth over time

### Alerts to Set Up
```bash
# Create CloudWatch alarm for failed uploads
aws cloudwatch put-metric-alarm \
  --alarm-name "MediaUpload-HighErrorRate" \
  --alarm-description "High error rate in media uploads" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --statistic "Sum" \
  --period 300 \
  --threshold 5 \
  --comparison-operator "GreaterThanThreshold" \
  --dimensions Name=FunctionName,Value=hold-that-thought-prod-media-upload \
  --evaluation-periods 2
```

## 🔧 Configuration Options

### Lambda Environment Variables
- `MAX_FILE_SIZE`: Maximum file size in bytes (default: 52428800 = 50MB)
- `ALLOWED_EXTENSIONS`: Comma-separated list of allowed file extensions
- `BUCKET_NAME`: S3 bucket name for uploads
- `REGION`: AWS region

### File Type Configuration
Update `MEDIA_TYPES` in the Lambda function to modify:
- Supported file extensions
- MIME type validation
- S3 folder structure
- File size limits per type

## 🛠️ Troubleshooting

### Common Issues

#### 1. "Access denied" errors
- **Check**: User is in ApprovedUsers group
- **Verify**: JWT token is valid and not expired
- **Test**: Use `/api/gallery/health` to verify authentication

#### 2. "File too large" errors
- **Check**: File size against limits (50MB/500MB)
- **Verify**: Lambda timeout is sufficient (5 minutes)
- **Consider**: Implementing chunked uploads for large files

#### 3. "Unsupported file type" errors
- **Check**: File extension is in allowed list
- **Verify**: MIME type matches file extension
- **Update**: Lambda environment variables if needed

#### 4. Upload timeouts
- **Check**: Lambda timeout setting (300 seconds)
- **Verify**: Network connectivity
- **Consider**: Implementing retry logic

### Debug Commands

```bash
# Check Lambda function logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/hold-that-thought"

# Get recent upload errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/hold-that-thought-prod-media-upload" \
  --start-time $(date -d "1 hour ago" +%s)000 \
  --filter-pattern "ERROR"

# Check S3 bucket contents
aws s3 ls s3://hold-that-thought-bucket/media/ --recursive

# Test upload endpoint
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","file_data":"base64data","content_type":"image/jpeg"}' \
  https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/prod/upload
```

## 🔄 Maintenance

### Regular Tasks
1. **Monitor Storage Costs**: Review S3 usage and costs monthly
2. **Clean Up Failed Uploads**: Remove incomplete multipart uploads
3. **Update File Type Support**: Add new formats as needed
4. **Review Access Logs**: Audit upload activity
5. **Update Dependencies**: Keep Lambda runtime and libraries current

### Backup Strategy
- **S3 Versioning**: Enabled for file recovery
- **Cross-Region Replication**: Consider for disaster recovery
- **Metadata Backup**: Export file metadata regularly
- **User Activity Logs**: Archive CloudWatch logs

## 🎯 Best Practices

### Performance Optimization
- **File Compression**: Encourage users to compress large files
- **Batch Uploads**: Process multiple files efficiently
- **Caching**: Cache validation results where possible
- **Async Processing**: Use SQS for heavy processing tasks

### Security Best Practices
- **Regular Token Rotation**: Implement token refresh
- **File Scanning**: Consider virus scanning for uploads
- **Rate Limiting**: Implement upload rate limits per user
- **Audit Logging**: Comprehensive logging of all activities

### User Experience
- **Progress Feedback**: Real-time upload progress
- **Error Messages**: Clear, actionable error messages
- **File Previews**: Show thumbnails before upload
- **Drag & Drop**: Intuitive file selection interface

The media upload system is now ready to securely handle family media uploads with enterprise-level security and monitoring! 🎉
