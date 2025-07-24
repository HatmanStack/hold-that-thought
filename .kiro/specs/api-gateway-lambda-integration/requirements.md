# Requirements Document

## Introduction

This feature involves configuring two API Gateway endpoints with Lambda function integrations and Cognito JWT authentication. The first endpoint will connect to a new Lambda function created from the existing `hold-that-thought-lambda` code that provides presigned URLs for PDF downloads. The second endpoint will connect to a new Lambda function for media uploads. Both endpoints must enforce authentication using JWTs issued by Cognito User Pool.

## Requirements

### Requirement 1: API Gateway Infrastructure Setup

**User Story:** As a system administrator, I want to create a new API Gateway infrastructure with Cognito authentication using the existing User Pool, so that Lambda functions can be integrated with secure endpoints.

#### Acceptance Criteria

1. WHEN the API Gateway is created THEN it SHALL have a Cognito User Pool authorizer configured with User Pool ID `us-west-2_X8J2UR7BF`
2. WHEN the authorizer is configured THEN it SHALL validate JWT tokens from the specified Cognito User Pool
3. WHEN the API Gateway is deployed THEN it SHALL be ready to accept Lambda function integrations
4. WHEN CORS is configured THEN the system SHALL allow cross-origin requests from authorized domains
5. WHEN the infrastructure is complete THEN it SHALL output the API Gateway ID and authorizer ID for Lambda integration

### Requirement 2: New PDF Download Lambda Function

**User Story:** As a system administrator, I want to create a new Lambda function based on the existing `hold-that-thought-lambda` code and integrate it with API Gateway, so that authenticated users can access PDF download functionality through a REST API endpoint.

#### Acceptance Criteria

1. WHEN a new Lambda function is created from the existing code THEN it SHALL be accessible via API Gateway endpoint
2. WHEN the Lambda function is deployed THEN it SHALL handle API Gateway proxy integration events
3. WHEN a user makes a request to the PDF endpoint THEN the system SHALL validate the Cognito JWT token
4. WHEN an authenticated user requests PDF access THEN the Lambda function SHALL return presigned URLs for PDF downloads
5. WHEN an unauthenticated user attempts access THEN the system SHALL return a 401 Unauthorized response
6. IF the user is not in the ApprovedUsers group THEN the system SHALL return a 403 Forbidden response

### Requirement 3: New Media Upload Lambda Function

**User Story:** As a system administrator, I want to deploy a new Lambda function for media uploads, so that authenticated users can upload files through the API.

#### Acceptance Criteria

1. WHEN the media upload Lambda function is deployed THEN it SHALL be accessible via API Gateway endpoint
2. WHEN a user uploads a file THEN the system SHALL validate the Cognito JWT token
3. WHEN an authenticated user uploads media THEN the Lambda function SHALL store files in the designated S3 bucket
4. WHEN file upload is successful THEN the system SHALL return upload confirmation with metadata
5. IF the uploaded file exceeds size limits THEN the system SHALL return a 400 Bad Request response
6. IF the file type is not allowed THEN the system SHALL return a 400 Bad Request response

### Requirement 4: Cognito JWT Authentication

**User Story:** As a security administrator, I want both API endpoints to enforce JWT authentication, so that only authorized users can access the Lambda functions.

#### Acceptance Criteria

1. WHEN any API endpoint is accessed THEN the system SHALL validate the JWT token from the Authorization header
2. WHEN the JWT token is valid THEN the system SHALL extract user claims and pass them to the Lambda function
3. WHEN the JWT token is invalid or missing THEN the system SHALL return a 401 Unauthorized response
4. WHEN the user is not in the ApprovedUsers group THEN the system SHALL return a 403 Forbidden response
5. WHEN the JWT token is expired THEN the system SHALL return a 401 Unauthorized response

### Requirement 5: API Gateway Configuration

**User Story:** As a developer, I want properly configured API Gateway endpoints with CORS support, so that web applications can interact with the Lambda functions.

#### Acceptance Criteria

1. WHEN API Gateway is configured THEN it SHALL have two endpoints: `/pdf-download` and `/upload`
2. WHEN CORS is configured THEN the system SHALL allow cross-origin requests from authorized domains
3. WHEN OPTIONS requests are made THEN the system SHALL return appropriate CORS headers
4. WHEN API Gateway receives requests THEN it SHALL use AWS_PROXY integration with Lambda functions
5. WHEN Lambda functions are invoked THEN they SHALL receive the complete request context including user claims

### Requirement 6: CloudFormation Template Updates

**User Story:** As a DevOps engineer, I want updated CloudFormation templates, so that the infrastructure can be deployed and managed consistently.

#### Acceptance Criteria

1. WHEN CloudFormation templates are updated THEN they SHALL include both Lambda function configurations
2. WHEN templates are deployed THEN they SHALL create all necessary IAM roles and permissions
3. WHEN API Gateway is deployed THEN it SHALL be properly linked to the Cognito User Pool authorizer
4. WHEN Lambda functions are deployed THEN they SHALL have appropriate execution roles and policies
5. WHEN the stack is deployed THEN it SHALL output the API Gateway URLs for both endpoints

### Requirement 7: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error handling and logging, so that I can monitor and troubleshoot the API endpoints.

#### Acceptance Criteria

1. WHEN errors occur in Lambda functions THEN they SHALL be logged to CloudWatch with appropriate detail
2. WHEN API Gateway receives invalid requests THEN it SHALL return standardized error responses
3. WHEN authentication fails THEN the system SHALL log the failure reason
4. WHEN file uploads fail THEN the system SHALL provide clear error messages to the client
5. WHEN system errors occur THEN they SHALL be logged without exposing sensitive information to clients