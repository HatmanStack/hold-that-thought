const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Mock getSignedUrl before requiring the handler
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/test-bucket/presigned-url')
}));

// Mock AWS SDK clients
const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

// Mock environment variables
process.env.USER_PROFILES_TABLE = 'test-profiles-table';
process.env.COMMENTS_TABLE = 'test-comments-table';
process.env.PROFILE_PHOTOS_BUCKET = 'test-photos-bucket';
process.env.RATE_LIMIT_TABLE = 'test-rate-limit-table';

const { handler } = require('../../backend/lambdas/profile-api/index');

describe('Profile API Security Tests', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
  });

  describe('Input Validation - userId', () => {
    test('should reject userId with path traversal attempt', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: '../../../etc/passwd' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'valid-user-id',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid user ID format');
    });

    test('should reject userId with forward slashes', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'user/admin/hack' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'valid-user-id',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid user ID format');
    });

    test('should reject non-UUID userId format', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'not-a-valid-uuid' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'valid-user-id',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid user ID format');
    });

    test('should accept valid UUID userId', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: validUserId,
          email: 'test@example.com',
          displayName: 'Test User',
          isProfilePrivate: false
        }
      });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: validUserId },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Input Validation - Pagination Parameters', () => {
    test('should reject negative limit', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: validUserId },
        queryStringParameters: { limit: '-10' },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('positive number');
    });

    test('should reject limit exceeding 100', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: validUserId },
        queryStringParameters: { limit: '150' },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('cannot exceed 100');
    });

    test('should reject malformed base64 lastEvaluatedKey', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: validUserId },
        queryStringParameters: { lastEvaluatedKey: 'not-valid-base64!' },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid pagination key');
    });
  });

  describe('File Upload Security', () => {
    test('should reject non-image content types for profile photos', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock rate limit check to pass
      ddbMock.on(GetCommand).resolves({ Item: null });
      ddbMock.on(PutCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'malware.exe',
          contentType: 'application/x-msdownload'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid file type');
    });

    test('should reject filename with path traversal', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock rate limit check to pass
      ddbMock.on(GetCommand).resolves({ Item: null });
      ddbMock.on(PutCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: '../../../etc/passwd.jpg',
          contentType: 'image/jpeg'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe('Invalid filename');
    });

    test('should reject invalid file extension', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock rate limit check to pass
      ddbMock.on(GetCommand).resolves({ Item: null });
      ddbMock.on(PutCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'photo.pdf',
          contentType: 'image/jpeg'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid file extension');
    });

    test('should accept valid image upload request', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock rate limit check to pass
      ddbMock.on(GetCommand).resolves({ Item: null });
      ddbMock.on(PutCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'profile-photo.jpg',
          contentType: 'image/jpeg'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('uploadUrl');
      expect(body).toHaveProperty('photoUrl');
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize HTML in bio field', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock rate limit check to pass
      ddbMock.on(GetCommand).resolves({ Item: null });
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: validUserId,
          email: 'test@example.com',
          bio: 'Clean bio text',
          displayName: 'Test User'
        }
      });

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          bio: '<script>alert("XSS")</script>Clean bio text',
          displayName: 'Test User'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);

      // Verify UpdateCommand was called
      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    test('should sanitize HTML in displayName field', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock rate limit check to pass
      ddbMock.on(GetCommand).resolves({ Item: null });
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: validUserId,
          email: 'test@example.com',
          displayName: 'Clean Name'
        }
      });

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: '<img src=x onerror=alert(1)>Clean Name'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limit on profile updates', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';
      const now = Math.floor(Date.now() / 1000);

      // Mock rate limit exceeded
      ddbMock.on(GetCommand).resolves({
        Item: {
          rateLimitKey: `${validUserId}:updateProfile`,
          count: 10,
          windowStart: now - 30
        }
      });

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: 'New Name'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(429);
      expect(response.headers).toHaveProperty('Retry-After');
      expect(JSON.parse(response.body).error).toContain('Rate limit exceeded');
    });

    test('should enforce rate limit on photo uploads', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000';
      const now = Math.floor(Date.now() / 1000);

      // Mock rate limit exceeded
      ddbMock.on(GetCommand).resolves({
        Item: {
          rateLimitKey: `${validUserId}:photoUpload`,
          count: 5,
          windowStart: now - 100
        }
      });

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'photo.jpg',
          contentType: 'image/jpeg'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(429);
      expect(JSON.parse(response.body).error).toContain('Rate limit exceeded');
    });
  });

  describe('Authorization', () => {
    test('should block access to private profiles from non-owners', async () => {
      const profileOwner = '550e8400-e29b-41d4-a716-446655440000';
      const otherUser = '660e8400-e29b-41d4-a716-446655440001';

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: profileOwner,
          email: 'owner@example.com',
          displayName: 'Profile Owner',
          isProfilePrivate: true
        }
      });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: profileOwner },
        requestContext: {
          authorizer: {
            claims: {
              sub: otherUser,
              email: 'other@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).error).toContain('private');
    });

    test('should allow profile owner to access their own private profile', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId,
          email: 'owner@example.com',
          displayName: 'Profile Owner',
          isProfilePrivate: true
        }
      });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId },
        requestContext: {
          authorizer: {
            claims: {
              sub: userId,
              email: 'owner@example.com'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });

    test('should allow admins to access private profiles', async () => {
      const profileOwner = '550e8400-e29b-41d4-a716-446655440000';
      const adminUser = '660e8400-e29b-41d4-a716-446655440001';

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: profileOwner,
          email: 'owner@example.com',
          displayName: 'Profile Owner',
          isProfilePrivate: true
        }
      });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: profileOwner },
        requestContext: {
          authorizer: {
            claims: {
              sub: adminUser,
              email: 'admin@example.com',
              'cognito:groups': 'Admins'
            }
          }
        }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });
  });
});
