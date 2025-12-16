import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

// Set env vars before any imports
process.env.TABLE_NAME = 'test-table'
process.env.ARCHIVE_BUCKET = 'test-bucket'
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'test-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

// Mock the presigner module before importing handler
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://test-bucket.s3.us-east-1.amazonaws.com/mock-key')
}))

const ddbMock = mockClient(DynamoDBDocumentClient)

// Use valid UUIDs for testing
const TEST_USER_UUID = '550e8400-e29b-41d4-a716-446655440000'
const PRIVATE_USER_UUID = '660e8400-e29b-41d4-a716-446655440001'
const OTHER_USER_UUID = '770e8400-e29b-41d4-a716-446655440002'
const ADMIN_USER_UUID = '880e8400-e29b-41d4-a716-446655440003'

let handler

beforeAll(async () => {
  // Clear module cache and import fresh
  vi.resetModules()
  const module = await import('../../backend/lambdas/api/index.js')
  handler = module.handler
})

beforeEach(() => {
  ddbMock.reset()
})

describe('profile API Lambda', () => {
  describe('GET /profile/{userId}', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        userId: TEST_USER_UUID,
        email: 'test@example.com',
        displayName: 'Test User',
        bio: 'Test bio',
        isProfilePrivate: false,
      }

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: TEST_USER_UUID },
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.userId).toBe(TEST_USER_UUID)
      expect(body.displayName).toBe('Test User')
    })

    it('should return 404 if profile not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: '990e8400-e29b-41d4-a716-446655440099' },
        requestContext: {
          authorizer: {
            claims: { sub: OTHER_USER_UUID, email: 'requester@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Profile not found')
    })

    it('should return 403 for private profile (non-owner)', async () => {
      const mockProfile = {
        userId: PRIVATE_USER_UUID,
        email: 'private@example.com',
        displayName: 'Private User',
        isProfilePrivate: true,
      }

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: PRIVATE_USER_UUID },
        requestContext: {
          authorizer: {
            claims: {
              sub: OTHER_USER_UUID,
              email: 'other@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('This profile is private')
    })

    it('should allow owner to view their private profile', async () => {
      const mockProfile = {
        userId: PRIVATE_USER_UUID,
        email: 'private@example.com',
        displayName: 'Private User',
        isProfilePrivate: true,
      }

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: PRIVATE_USER_UUID },
        requestContext: {
          authorizer: {
            claims: {
              sub: PRIVATE_USER_UUID,
              email: 'private@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
    })

    it('should allow admin to view private profile', async () => {
      const mockProfile = {
        userId: PRIVATE_USER_UUID,
        email: 'private@example.com',
        displayName: 'Private User',
        isProfilePrivate: true,
      }

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: PRIVATE_USER_UUID },
        requestContext: {
          authorizer: {
            claims: {
              'sub': ADMIN_USER_UUID,
              'email': 'admin@example.com',
              'cognito:groups': 'Admins,ApprovedUsers',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
    })
  })

  describe('PUT /profile', () => {
    it('should update user profile', async () => {
      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: TEST_USER_UUID,
          email: 'test@example.com',
          displayName: 'Updated Name',
          bio: 'Updated bio',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: 'Updated Name',
          bio: 'Updated bio',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.displayName).toBe('Updated Name')
    })

    it('should return 400 for bio too long', async () => {
      const longBio = 'a'.repeat(501)

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          bio: longBio,
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Bio must be 500 characters or less')
    })

    it('should return 400 for displayName too long', async () => {
      const longName = 'a'.repeat(101)

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: longName,
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Display name must be 100 characters or less')
    })

    it('should sanitize XSS payloads in bio and displayName', async () => {
      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: TEST_USER_UUID,
          email: 'test@example.com',
          displayName: 'alert(XSS)',
          bio: 'scriptalert(XSS)/script',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: '<script>alert("XSS")</script>',
          bio: '<script>alert("XSS")</script>',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)

      // Verify UpdateCommand was called with sanitized values
      const updateCalls = ddbMock.commandCalls(UpdateCommand)
      expect(updateCalls.length).toBeGreaterThan(0)

      const lastCall = updateCalls[updateCalls.length - 1]
      const values = lastCall.args[0].input.ExpressionAttributeValues

      // HTML tags should be stripped
      expect(values[':displayName']).not.toContain('<script>')
      expect(values[':displayName']).not.toContain('</script>')
      expect(values[':bio']).not.toContain('<script>')
      expect(values[':bio']).not.toContain('</script>')
    })
  })

  describe('GET /profile/{userId}/comments', () => {
    it('should return user comment history', async () => {
      const mockProfile = {
        userId: TEST_USER_UUID,
        email: 'test@example.com',
        isProfilePrivate: false,
      }

      const mockComments = [
        {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
          userId: TEST_USER_UUID,
          commentText: 'Great letter!',
          isDeleted: false,
        },
        {
          itemId: '/2016/summer',
          commentId: '2025-01-14T09:00:00.000Z#def',
          userId: TEST_USER_UUID,
          commentText: 'Love this!',
          isDeleted: false,
        },
      ]

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(QueryCommand).resolves({ Items: mockComments })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: TEST_USER_UUID },
        queryStringParameters: { limit: '50' },
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.items).toHaveLength(2)
      expect(body.items[0].commentText).toBe('Great letter!')
    })

    it('should filter out deleted comments', async () => {
      const mockProfile = {
        userId: TEST_USER_UUID,
        email: 'test@example.com',
        isProfilePrivate: false,
      }

      const mockComments = [
        {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
          userId: TEST_USER_UUID,
          commentText: 'Great letter!',
          isDeleted: false,
        },
        {
          itemId: '/2016/summer',
          commentId: '2025-01-14T09:00:00.000Z#def',
          userId: TEST_USER_UUID,
          commentText: 'Deleted comment',
          isDeleted: true,
        },
      ]

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(QueryCommand).resolves({ Items: mockComments })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: TEST_USER_UUID },
        queryStringParameters: {},
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.items).toHaveLength(1)
      expect(body.items[0].isDeleted).toBe(false)
    })

    it('should return 403 for private profile comments', async () => {
      const mockProfile = {
        userId: PRIVATE_USER_UUID,
        email: 'private@example.com',
        isProfilePrivate: true,
      }

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: PRIVATE_USER_UUID },
        queryStringParameters: {},
        requestContext: {
          authorizer: {
            claims: {
              sub: OTHER_USER_UUID,
              email: 'other@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('This profile is private')
    })
  })

  describe('error handling', () => {
    it('should return 401 if no user context', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: TEST_USER_UUID },
        requestContext: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Unauthorized')
    })

    it('should return 404 for unknown route', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/profile/unknown',
        requestContext: {
          authorizer: {
            claims: {
              sub: TEST_USER_UUID,
              email: 'test@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Route not found')
    })
  })
})
