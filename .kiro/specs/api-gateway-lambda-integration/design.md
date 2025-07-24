# Design Document

## Overview

This design outlines the creation of a new API Gateway with two Lambda functions, secured by Cognito JWT authentication. The solution involves:

1. **New API Gateway Creation**: Creating a new API Gateway with Cognito User Pool authorizer using existing User Pool ID `us-west-2_X8J2UR7BF`
2. **New PDF Download Lambda**: Creating a new Lambda function based on the existing `hold-that-thought-lambda` code to provide PDF download functionality
3. **New Media Upload Lambda**: Deploying a new Lambda function for media upload with S3 integration
4. **Security Implementation**: Enforcing JWT validation and user group authorization

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Web Client    │───▶│  NEW API Gateway │───▶│  Cognito Authorizer │
│                 │    │                  │    │ (us-west-2_X8J2UR7BF)│
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Route Handler  │
                       │                 │
                       └─────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
        ┌─────────────────────┐   ┌─────────────────────┐
        │ NEW pdf-download-   │   │  NEW media-upload-  │
        │ lambda              │   │  lambda             │
        │ (Based on existing  │   │ (File Uploads)      │
        │  hold-that-thought) │   │                     │
        └─────────────────────┘   └─────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
                    ┌─────────────────────────────┐
                    │ hold-that-thought-bucket    │
                    │ (us-west-2)                 │
                    │                             │
                    │ ├── urara/ (existing PDFs)  │
                    │ ├── media/pictures/         │
                    │ ├── media/videos/           │
                    │ └── media/documents/        │
                    └─────────────────────────────┘
```

### Component Architecture

#### API Gateway Layer
- **REST API**: Single API Gateway instance with multiple resources
- **Authorizer**: Cognito User Pool JWT authorizer
- **Resources**: `/pdf-download` and `/upload` endpoints
- **CORS**: Configured for web client access
- **Integration**: AWS_PROXY integration with Lambda functions

#### Authentication Layer
- **Cognito User Pool**: JWT token issuer and validator
- **ApprovedUsers Group**: Authorization group for access control
- **JWT Claims**: User identity and group membership validation

#### Lambda Functions Layer
- **PDF Download Lambda**: New function created from existing `hold-that-thought-lambda` code for presigned URL generation
- **Media Upload Lambda**: New function for file upload processing
- **Execution Roles**: Separate IAM roles with minimal required permissions

#### Storage Layer
- **Unified Storage**: Single `hold-that-thought-bucket` (us-west-2) for all content
  - **PDF Files**: Existing PDF storage with current download logic
  - **Media Files**: Organized by type in `media/` prefixes:
    - `media/pictures/` - Image files
    - `media/videos/` - Video files  
    - `media/documents/` - Document files

## Components and Interfaces

### API Gateway Configuration

#### Endpoints
1. **PDF Download Endpoint**
   - Path: `/pdf-download`
   - Method: `GET`
   - Authentication: Cognito JWT
   - Integration: AWS_PROXY with new PDF download Lambda (based on existing `hold-that-thought-lambda`)

2. **Media Upload Endpoint**
   - Path: `/upload`
   - Method: `POST`
   - Authentication: Cognito JWT
   - Integration: AWS_PROXY with new media upload Lambda

#### CORS Configuration
```yaml
Access-Control-Allow-Origin: "*"
Access-Control-Allow-Headers: "Content-Type,Authorization"
Access-Control-Allow-Methods: "GET,POST,OPTIONS"
```

### Lambda Function Interfaces

#### PDF Download Lambda Interface
```javascript
// Input Event Structure (API Gateway Proxy Integration)
{
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "user-id",
        "email": "user@example.com",
        "cognito:groups": "ApprovedUsers"
      }
    }
  },
  "queryStringParameters": {
    "filename": "document.pdf" // optional
  },
  "headers": {
    "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

// Required Lambda Function Updates:
// 1. Add JWT token validation logic
// 2. Extract user claims from requestContext.authorizer.claims
// 3. Validate ApprovedUsers group membership
// 4. Return API Gateway compatible response format
// 5. Add CORS headers for web client compatibility

// Output Response Structure (API Gateway Compatible)
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
  },
  "body": JSON.stringify({
    "presignedUrl": "https://s3.amazonaws.com/...",
    "expiresIn": 3600,
    "filename": "document.pdf",
    "user": {
      "id": "user-id",
      "email": "user@example.com"
    }
  })
}
```

#### Media Upload Lambda Interface
```javascript
// Input Event Structure
{
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "user-id",
        "email": "user@example.com",
        "cognito:groups": "ApprovedUsers"
      }
    }
  },
  "body": "base64-encoded-file-data",
  "isBase64Encoded": true,
  "headers": {
    "content-type": "multipart/form-data"
  }
}

// Output Response Structure
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": JSON.stringify({
    "success": true,
    "filename": "uploaded-file.jpg",
    "s3Key": "media/pictures/uuid_filename.jpg",
    "uploadTime": "2025-01-01T00:00:00Z"
  })
}
```

### Cognito Integration

#### JWT Token Validation
- **Token Source**: `Authorization` header with `Bearer` prefix
- **Validation**: Automatic validation by API Gateway Cognito authorizer
- **Claims Extraction**: User claims passed to Lambda context
- **Group Validation**: Lambda functions validate `ApprovedUsers` group membership

#### User Claims Structure
```json
{
  "sub": "user-unique-id",
  "email": "user@example.com",
  "cognito:groups": "ApprovedUsers",
  "aud": "client-id",
  "exp": 1640995200,
  "iat": 1640991600
}
```

## Data Models

### PDF Download Request
```typescript
interface PDFDownloadRequest {
  filename?: string;
  userId: string;
  userEmail: string;
  userGroups: string[];
}
```

### PDF Download Response
```typescript
interface PDFDownloadResponse {
  presignedUrl: string;
  expiresIn: number;
  filename: string;
  generatedAt: string;
}
```

### Media Upload Request
```typescript
interface MediaUploadRequest {
  fileData: Buffer;
  filename: string;
  contentType: string;
  userId: string;
  userEmail: string;
  userGroups: string[];
}
```

### Media Upload Response
```typescript
interface MediaUploadResponse {
  success: boolean;
  filename: string;
  mediaType: 'pictures' | 'videos' | 'documents';
  s3Key: string;
  fileSize: number;
  uploadTime: string;
  uploadedBy: string;
}
```

### Error Response
```typescript
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  timestamp: string;
}
```

## Error Handling

### Authentication Errors
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Valid token but insufficient permissions (not in ApprovedUsers group)

### Validation Errors
- **400 Bad Request**: Invalid request format, file size exceeded, unsupported file type
- **413 Payload Too Large**: File size exceeds Lambda payload limits

### Server Errors
- **500 Internal Server Error**: Lambda execution errors, S3 access issues
- **502 Bad Gateway**: API Gateway integration errors
- **504 Gateway Timeout**: Lambda timeout errors

### Error Response Format
All errors follow a consistent format:
```json
{
  "error": "Error Type",
  "message": "Human-readable error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## Testing Strategy

### Unit Testing
- **Lambda Functions**: Test individual function logic with mock events
- **Authentication Logic**: Test JWT claim extraction and group validation
- **File Processing**: Test upload validation and S3 operations

### Integration Testing
- **API Gateway**: Test endpoint routing and authentication
- **Lambda Integration**: Test AWS_PROXY integration with actual Lambda functions
- **S3 Operations**: Test file upload and presigned URL generation

### End-to-End Testing
- **Authentication Flow**: Test complete JWT authentication process
- **PDF Download Flow**: Test complete PDF download workflow
- **Media Upload Flow**: Test complete file upload workflow
- **Error Scenarios**: Test various error conditions and responses

### Security Testing
- **JWT Validation**: Test token validation and expiration
- **Authorization**: Test group-based access control
- **Input Validation**: Test file upload validation and sanitization
- **CORS**: Test cross-origin request handling

### Performance Testing
- **Lambda Cold Start**: Test function initialization times
- **File Upload**: Test large file upload performance
- **Concurrent Requests**: Test API Gateway and Lambda scaling
- **S3 Operations**: Test S3 upload and download performance

## Deployment Strategy

### CloudFormation Stack Dependencies
1. **Cognito User Pool Stack**: Must be deployed first
2. **S3 Bucket Stack**: Must be deployed before Lambda functions
3. **API Gateway Stack**: Updated to include new endpoints
4. **Lambda Function Stacks**: Deploy both PDF and upload functions

### Environment Configuration
- **Development**: Separate stacks with dev prefixes
- **Production**: Production stacks with appropriate resource sizing
- **Configuration**: Environment-specific parameters for bucket names, regions, etc.

### Rollback Strategy
- **CloudFormation Rollback**: Automatic rollback on stack deployment failures
- **Lambda Versioning**: Use Lambda versions for safe deployments
- **API Gateway Stages**: Use staging for testing before production deployment

## Security Considerations

### Authentication Security
- **JWT Validation**: Proper token signature validation
- **Token Expiration**: Enforce token expiration times
- **Group Validation**: Strict group membership validation

### Data Security
- **S3 Encryption**: Server-side encryption for all stored files
- **HTTPS Only**: Enforce HTTPS for all API communications
- **Input Sanitization**: Validate and sanitize all file uploads

### Access Control
- **Least Privilege**: IAM roles with minimal required permissions
- **Resource Isolation**: Separate S3 prefixes for different file types
- **Audit Logging**: CloudWatch logs for all operations

### Network Security
- **CORS Configuration**: Restrictive CORS policies
- **API Gateway Throttling**: Rate limiting to prevent abuse
- **Lambda VPC**: Consider VPC deployment for sensitive operations