# Gallery System Setup Guide

This document explains how to set up and use the secure family gallery system with API Gateway + Lambda + S3 architecture.

## 🏗️ Architecture Overview

The gallery system uses a secure, serverless architecture with no AWS credentials on the frontend:

```
Frontend → SvelteKit API → Gallery API Gateway → Lambda Functions → S3 Bucket
                        ↓                      ↓
                   JWT Token              Cognito Auth
                        ↓                      ↓
              ApprovedUsers Check      IAM Role Access
```

### Security Components:
- **Frontend**: No AWS credentials, only calls SvelteKit API endpoints
- **SvelteKit API**: Validates JWT tokens and forwards to Gallery API Gateway
- **Gallery API Gateway**: Cognito JWT authorizer validates tokens
- **Lambda Functions**: Use IAM roles (no hardcoded credentials) to access S3
- **S3 Storage**: Private bucket with signed URLs for secure access
- **Authentication**: Multi-layer JWT validation + ApprovedUsers group check

## 🚀 Deployment Steps

### 1. Deploy S3 Gallery Infrastructure

```bash
cd aws-infrastructure

# Deploy the S3 bucket (no credentials needed - uses IAM roles)
aws cloudformation deploy \
  --template-file s3-gallery-bucket.yaml \
  --stack-name hold-that-thought-gallery \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=hold-that-thought \
    Environment=prod
```

### 2. Deploy Gallery API Gateway + Lambda

```bash
# Get the User Pool ARN from your Cognito stack
USER_POOL_ARN=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolArn`].OutputValue' \
  --output text)

# Get the S3 bucket name
S3_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-gallery \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

# Deploy the Gallery API Gateway and Lambda functions
aws cloudformation deploy \
  --template-file gallery-api-gateway.yaml \
  --stack-name hold-that-thought-gallery-api \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=hold-that-thought \
    Environment=prod \
    UserPoolArn=$USER_POOL_ARN \
    S3BucketName=$S3_BUCKET_NAME
```

### 3. Get API Gateway URL

After deployment, get the Gallery API Gateway URL:

```bash
# Get the Gallery API Gateway URL
GALLERY_API_URL=$(aws cloudformation describe-stacks \
  --stack-name hold-that-thought-gallery-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)

echo "Gallery API URL: $GALLERY_API_URL"
```

### 4. Update Environment Variables

Add the Gallery API URL to your `.env` file (NO AWS credentials needed):

```bash
# Gallery API Gateway URL (Required for Gallery functionality)
PUBLIC_GALLERY_API_URL=https://your-gallery-api-id.execute-api.us-east-1.amazonaws.com/prod
```

### 4. Upload Media Files

Create the folder structure in your S3 bucket:

```
hold-that-thought-prod-gallery/
├── gallery/
│   ├── pictures/
│   │   ├── family-reunion-2023.jpg
│   │   ├── christmas-1995.png
│   │   └── vacation-photos/
│   ├── videos/
│   │   ├── birthday-party.mp4
│   │   ├── wedding-ceremony.mov
│   │   └── family-interviews/
│   ├── documents/
│   │   ├── family-tree.pdf
│   │   ├── letters/
│   │   └── certificates/
│   └── thumbnails/
│       ├── family-reunion-2023.jpg
│       └── christmas-1995.jpg
```

## 📁 File Organization

### Supported File Types

#### Pictures
- **Formats**: JPG, JPEG, PNG, GIF, WebP, BMP
- **Location**: `gallery/pictures/`
- **Thumbnails**: Auto-generated in `gallery/thumbnails/`

#### Videos
- **Formats**: MP4, AVI, MOV, WMV, FLV, WebM
- **Location**: `gallery/videos/`
- **Thumbnails**: Manual upload to `gallery/video-thumbnails/` (optional)

#### Documents
- **Formats**: PDF, DOC, DOCX, TXT, RTF
- **Location**: `gallery/documents/`
- **Preview**: Download-only (no inline preview)

### File Naming Best Practices

```bash
# Good examples
family-reunion-2023.jpg
christmas-morning-1995.png
grandpa-interview-2020.mp4
family-tree-updated.pdf

# Avoid
IMG_1234.jpg (not descriptive)
file with spaces.jpg (use hyphens instead)
ALLCAPS.JPG (use lowercase)
```

## 🔐 Security Features

### Authentication Flow
1. **User Login**: Google OAuth through Cognito
2. **Group Check**: Verify user is in `ApprovedUsers` group
3. **API Request**: Authenticated request to gallery endpoints
4. **S3 Access**: Generate signed URLs (1-hour expiration)
5. **Media Display**: Secure access to family content

### Access Control
- **Unauthenticated Users**: Cannot access gallery
- **Authenticated but Unapproved**: Redirected to pending approval page
- **Approved Users**: Full access to all gallery sections

### Data Protection
- **Encrypted Storage**: S3 server-side encryption (AES-256)
- **Private Bucket**: No public access, all access via signed URLs
- **Versioning**: File versioning enabled for recovery
- **Lifecycle Rules**: Automatic cleanup of incomplete uploads

## 🎨 Gallery Features

### User Interface
- **Three Sections**: Pictures, Videos, Documents
- **Grid Layout**: Responsive card-based design
- **Modal Viewer**: Full-size viewing with details
- **File Information**: Size, upload date, description
- **Loading States**: Smooth loading indicators
- **Error Handling**: User-friendly error messages

### Media Handling
- **Signed URLs**: Secure, time-limited access to files
- **Thumbnails**: Automatic generation for pictures
- **Video Previews**: Thumbnail support for videos
- **Document Icons**: Type-specific icons for documents
- **File Size Display**: Human-readable file sizes

## 🛠️ API Endpoints

### Gallery Endpoints
```
GET /api/gallery/pictures  - List all pictures
GET /api/gallery/videos    - List all videos
GET /api/gallery/documents - List all documents
GET /api/gallery/health    - Health check
```

### Response Format
```json
{
  "success": true,
  "items": [
    {
      "id": "gallery_pictures_family_reunion_2023_jpg",
      "filename": "family-reunion-2023.jpg",
      "title": "Family Reunion 2023",
      "description": "Annual family gathering",
      "uploadDate": "2023-12-01T10:30:00.000Z",
      "fileSize": 2048576,
      "contentType": "image/jpeg",
      "signedUrl": "https://s3.amazonaws.com/...",
      "thumbnailUrl": "https://s3.amazonaws.com/...",
      "category": "pictures"
    }
  ],
  "section": "pictures",
  "user": {
    "id": "user-123",
    "email": "user@example.com"
  }
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "Failed to load pictures/videos/documents"
- **Check**: AWS credentials in `.env` file
- **Verify**: S3 bucket exists and has correct permissions
- **Test**: Visit `/api/gallery/health` to check S3 connection

#### 2. "Authentication required"
- **Check**: User is logged in with valid JWT token
- **Verify**: Token hasn't expired (check browser dev tools)
- **Test**: Visit `/auth-status` to check authentication

#### 3. "Access denied. User not in ApprovedUsers group"
- **Check**: User is added to ApprovedUsers group in Cognito
- **Add user**: Use the `add-approved-user.js` script
- **Verify**: Check user's groups in Cognito console

#### 4. Images not loading
- **Check**: Files are in correct S3 folder (`gallery/pictures/`)
- **Verify**: File types are supported (JPG, PNG, etc.)
- **Test**: Check S3 bucket contents in AWS console

### Debug Commands

```bash
# Check S3 bucket contents
aws s3 ls s3://hold-that-thought-prod-gallery/gallery/ --recursive

# Test API endpoint (replace with your domain)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-app.com/api/gallery/pictures

# Check CloudFormation stack status
aws cloudformation describe-stacks --stack-name hold-that-thought-gallery
```

## 📊 Monitoring

### CloudWatch Logs
- **S3 Events**: `/aws/s3/hold-that-thought-prod-gallery`
- **Lambda Processing**: `/aws/lambda/hold-that-thought-prod-image-processor`

### Metrics to Monitor
- **API Response Times**: Gallery endpoint performance
- **S3 Request Counts**: Usage patterns
- **Error Rates**: Failed authentication or S3 access
- **Storage Usage**: S3 bucket size and costs

## 🔄 Maintenance

### Regular Tasks
1. **Review Access**: Audit ApprovedUsers group membership
2. **Clean Up**: Remove old or unwanted files
3. **Backup**: Ensure S3 versioning is working
4. **Monitor Costs**: Check S3 storage and request costs
5. **Update Thumbnails**: Generate thumbnails for new images

### File Management
```bash
# Upload new files (example)
aws s3 cp local-photo.jpg s3://hold-that-thought-prod-gallery/gallery/pictures/

# Create folder structure
aws s3api put-object --bucket hold-that-thought-prod-gallery --key gallery/pictures/
aws s3api put-object --bucket hold-that-thought-prod-gallery --key gallery/videos/
aws s3api put-object --bucket hold-that-thought-prod-gallery --key gallery/documents/
```

## 🎯 Best Practices

### File Organization
- Use descriptive filenames
- Organize in subfolders by year/event
- Keep file sizes reasonable (< 50MB per file)
- Generate thumbnails for better performance

### Security
- Regularly rotate AWS access keys
- Monitor access logs for unusual activity
- Keep the ApprovedUsers group up to date
- Use strong authentication for AWS console access

### Performance
- Optimize image sizes before upload
- Use appropriate file formats (WebP for web, MP4 for video)
- Monitor signed URL expiration times
- Consider CDN for frequently accessed files

The gallery system is now ready to securely serve your family's precious memories! 🎉
