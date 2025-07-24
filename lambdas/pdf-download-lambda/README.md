# PDF Download Lambda Function

This Lambda function provides secure PDF download functionality through API Gateway with Cognito JWT authentication. It's designed to work with API Gateway proxy integration and validates user permissions before generating presigned S3 URLs.

## Features

- **API Gateway Integration**: Handles API Gateway proxy integration events
- **JWT Authentication**: Validates Cognito JWT tokens from API Gateway authorizer
- **Group Authorization**: Ensures users are in the "ApprovedUsers" group
- **S3 Integration**: Generates presigned URLs for secure PDF downloads
- **CORS Support**: Includes proper CORS headers for web client access
- **Error Handling**: Comprehensive error handling with standardized responses

## Environment Variables

- `BUCKET_NAME`: S3 bucket name containing PDF files (required)
- `AWS_REGION`: AWS region (default: us-west-2)
- `CORS_ORIGIN`: CORS origin header (default: *)

## API Gateway Event Structure

The function expects API Gateway proxy integration events with the following structure:

```json
{
  "httpMethod": "GET",
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
    "filename": "document.pdf"
  }
}
```

## Response Format

### Success Response (200)
```json
{
  "presignedUrl": "https://s3.amazonaws.com/...",
  "expiresIn": 3600,
  "filename": "document.pdf",
  "generatedAt": "2025-01-01T00:00:00Z",
  "user": {
    "id": "user-id",
    "email": "user@example.com"
  }
}
```

### Error Response
```json
{
  "error": "Error Type",
  "message": "Human-readable error description",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## HTTP Status Codes

- `200`: Success - PDF download URL generated
- `401`: Unauthorized - Invalid or missing JWT token
- `403`: Forbidden - User not in ApprovedUsers group
- `404`: Not Found - No PDF found for requested resource
- `405`: Method Not Allowed - HTTP method not supported
- `500`: Internal Server Error - Server-side error

## S3 Structure

The function expects PDFs to be stored in S3 with the following structure:
```
bucket-name/
├── urara/
│   ├── document-title-1/
│   │   └── document.pdf
│   ├── document-title-2/
│   │   └── document.pdf
│   └── ...
```

## Security Features

1. **JWT Validation**: Validates JWT tokens from Cognito User Pool
2. **Group Authorization**: Checks ApprovedUsers group membership
3. **Presigned URLs**: Uses S3 presigned URLs with 1-hour expiration
4. **CORS Protection**: Configurable CORS headers
5. **Input Validation**: Validates all input parameters

## Testing

The function can be tested with mock API Gateway events. See the test directory for examples.

## Deployment

This function is designed to be deployed via CloudFormation with:
- IAM role with S3 read permissions
- Environment variables configuration
- API Gateway integration
- CloudWatch logging

## Dependencies

- `@aws-sdk/client-s3`: S3 operations
- `@aws-sdk/s3-request-presigner`: Presigned URL generation

## Error Handling

The function includes comprehensive error handling for:
- Missing environment variables
- Invalid JWT tokens
- Insufficient permissions
- S3 operation failures
- Missing PDF files
- Network errors

All errors are logged to CloudWatch and return standardized error responses to the client.