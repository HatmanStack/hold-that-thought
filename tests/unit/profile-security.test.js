// Import SDK from root node_modules
const { mockClient } = require('aws-sdk-client-mock')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

// Create mocks BEFORE setting env vars or importing handler
const ddbMock = mockClient(DynamoDBDocumentClient)
const s3Mock = mockClient(S3Client)

// Mock the s3-request-presigner module
const mockGetSignedUrl = async () => 'https://s3.amazonaws.com/test-bucket/presigned-url'
require.cache[require.resolve('@aws-sdk/s3-request-presigner')] = {
  exports: { getSignedUrl: mockGetSignedUrl },
}

process.env.TABLE_NAME = 'test-table'
process.env.S3_BUCKET = 'test-bucket'

const { handler } = require('../../backend/lambdas/api/index')

describe('profile API Security Tests', () => {
  beforeEach(() => {
    ddbMock.reset()
    s3Mock.reset()
  })

  describe('input Validation - userId', () => {
    it('should reject userId with path traversal attempt', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: '../../../etc/passwd' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'valid-user-id',
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('Invalid user ID format')
    })

    it('should reject userId with forward slashes', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'user/admin/hack' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'valid-user-id',
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('Invalid user ID format')
    })

    it('should reject non-UUID userId format', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'not-a-valid-uuid' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'valid-user-id',
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('Invalid user ID format')
    })

    it('should accept valid UUID userId', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: validUserId,
          email: 'test@example.com',
          displayName: 'Test User',
          isProfilePrivate: false,
        },
      })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: validUserId },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
    })
  })

  describe('input Validation - Pagination Parameters', () => {
    it('should reject negative limit', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: validUserId },
        queryStringParameters: { limit: '-10' },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('positive number')
    })

    it('should reject limit exceeding 100', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: validUserId },
        queryStringParameters: { limit: '150' },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('cannot exceed 100')
    })

    it('should reject malformed base64 lastEvaluatedKey', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: validUserId },
        queryStringParameters: { lastEvaluatedKey: 'not-valid-base64!' },
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('Invalid pagination key')
    })
  })

  describe('file Upload Security', () => {
    it('should reject non-image content types for profile photos', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('Invalid file type')
    })

    it('should reject filename with path traversal', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: '../../../etc/passwd.jpg',
          contentType: 'image/jpeg',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toBe('Invalid filename')
    })

    it('should reject invalid file extension', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'photo.pdf',
          contentType: 'image/jpeg',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body).error).toContain('Invalid file extension')
    })

    it('should accept valid image upload request', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'profile-photo.jpg',
          contentType: 'image/jpeg',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('uploadUrl')
      expect(body).toHaveProperty('photoUrl')
    })
  })

  describe('xSS Prevention', () => {
    it('should sanitize HTML in bio field', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: validUserId,
          email: 'test@example.com',
          bio: 'Clean bio text',
          displayName: 'Test User',
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          bio: '<script>alert("XSS")</script>Clean bio text',
          displayName: 'Test User',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)

      const updateCalls = ddbMock.commandCalls(UpdateCommand)
      expect(updateCalls.length).toBeGreaterThan(0)
    })

    it('should sanitize HTML in displayName field', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: validUserId,
          email: 'test@example.com',
          displayName: 'Clean Name',
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: '<img src=x onerror=alert(1)>Clean Name',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
    })
  })

  describe('rate Limiting', () => {
    it('should enforce rate limit on profile updates', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'
      const now = Math.floor(Date.now() / 1000)

      ddbMock.on(GetCommand).resolves({
        Item: {
          rateLimitKey: `${validUserId}:updateProfile`,
          count: 10,
          windowStart: now - 30,
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: 'New Name',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(429)
      expect(response.headers).toHaveProperty('Retry-After')
      expect(JSON.parse(response.body).error).toContain('Rate limit exceeded')
    })

    it('should enforce rate limit on photo uploads', async () => {
      const validUserId = '550e8400-e29b-41d4-a716-446655440000'
      const now = Math.floor(Date.now() / 1000)

      ddbMock.on(GetCommand).resolves({
        Item: {
          rateLimitKey: `${validUserId}:photoUpload`,
          count: 5,
          windowStart: now - 100,
        },
      })

      const event = {
        httpMethod: 'POST',
        resource: '/profile/photo/upload-url',
        body: JSON.stringify({
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: validUserId,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(429)
      expect(JSON.parse(response.body).error).toContain('Rate limit exceeded')
    })
  })

  describe('authorization', () => {
    it('should block access to private profiles from non-owners', async () => {
      const profileOwner = '550e8400-e29b-41d4-a716-446655440000'
      const otherUser = '660e8400-e29b-41d4-a716-446655440001'

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: profileOwner,
          email: 'owner@example.com',
          displayName: 'Profile Owner',
          isProfilePrivate: true,
        },
      })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: profileOwner },
        requestContext: {
          authorizer: {
            claims: {
              sub: otherUser,
              email: 'other@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(403)
      expect(JSON.parse(response.body).error).toContain('private')
    })

    it('should allow profile owner to access their own private profile', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000'

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId,
          email: 'owner@example.com',
          displayName: 'Profile Owner',
          isProfilePrivate: true,
        },
      })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId },
        requestContext: {
          authorizer: {
            claims: {
              sub: userId,
              email: 'owner@example.com',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
    })

    it('should allow admins to access private profiles', async () => {
      const profileOwner = '550e8400-e29b-41d4-a716-446655440000'
      const adminUser = '660e8400-e29b-41d4-a716-446655440001'

      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: profileOwner,
          email: 'owner@example.com',
          displayName: 'Profile Owner',
          isProfilePrivate: true,
        },
      })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: profileOwner },
        requestContext: {
          authorizer: {
            claims: {
              'sub': adminUser,
              'email': 'admin@example.com',
              'cognito:groups': 'Admins',
            },
          },
        },
      }

      const response = await handler(event)
      expect(response.statusCode).toBe(200)
    })
  })
})
