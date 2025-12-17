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
  vi.resetModules()
  const module = await import('../../backend/lambdas/api/index.js')
  handler = module.handler
})

beforeEach(() => {
  ddbMock.reset()
})

// Helper to create mock profile with required entityType
const mockProfile = (userId, overrides = {}) => ({
  PK: `USER#${userId}`,
  SK: `PROFILE#${userId}`,
  entityType: 'USER_PROFILE',
  userId,
  email: `${userId.slice(0, 8)}@example.com`,
  displayName: 'Test User',
  bio: 'Test bio',
  isProfilePrivate: false,
  ...overrides,
})

describe('profile API Lambda', () => {
  describe('GET /profile/{userId}', () => {
    it('should return user profile', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
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
      ddbMock.on(GetCommand).resolves({
        Item: mockProfile(PRIVATE_USER_UUID, { isProfilePrivate: true })
      })
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
      ddbMock.on(GetCommand).resolves({
        Item: mockProfile(PRIVATE_USER_UUID, { isProfilePrivate: true })
      })
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
      ddbMock.on(GetCommand).resolves({
        Item: mockProfile(PRIVATE_USER_UUID, { isProfilePrivate: true })
      })
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

    it('should truncate displayName to 100 chars during sanitization', async () => {
      // Handler sanitizes (truncates) before validating, so long names become 100 chars
      const longName = 'a'.repeat(150)

      ddbMock.on(GetCommand).resolves({ Item: null })
      ddbMock.on(PutCommand).resolves({})

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

      // Should succeed because sanitizeText truncates to 100 chars
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.displayName.length).toBeLessThanOrEqual(100)
    })

    it('should sanitize XSS payloads in bio and displayName', async () => {
      // Profile must exist for UpdateCommand to be used
      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
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

  describe('family relationships', () => {
    it('should save family relationships with profile update', async () => {
      const relationships = [
        {
          id: 'rel-1',
          type: 'Grandmother (maternal)',
          name: 'Mary Smith',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
        {
          id: 'rel-2',
          type: 'Other',
          customType: "Mom's cousin",
          name: 'Bob Jones',
          createdAt: '2025-01-15T10:01:00.000Z',
        },
      ]

      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: TEST_USER_UUID,
          displayName: 'Test User',
          familyRelationships: relationships,
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({ familyRelationships: relationships }),
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)

      // Verify UpdateCommand was called with relationships
      const updateCalls = ddbMock.commandCalls(UpdateCommand)
      expect(updateCalls.length).toBeGreaterThan(0)

      const lastCall = updateCalls[updateCalls.length - 1]
      const values = lastCall.args[0].input.ExpressionAttributeValues

      expect(values[':familyRelationships']).toEqual(relationships)
    })

    it('should return empty array when no relationships exist', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: TEST_USER_UUID },
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.familyRelationships).toEqual([])
    })

    it('should return family relationships in profile response', async () => {
      const relationships = [
        {
          id: 'rel-1',
          type: 'Father',
          name: 'John Smith',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
      ]

      ddbMock.on(GetCommand).resolves({
        Item: mockProfile(TEST_USER_UUID, { familyRelationships: relationships }),
      })

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: TEST_USER_UUID },
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.familyRelationships).toHaveLength(1)
      expect(body.familyRelationships[0].type).toBe('Father')
      expect(body.familyRelationships[0].name).toBe('John Smith')
    })

    it('should accept empty relationships array', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: TEST_USER_UUID,
          displayName: 'Test User',
          familyRelationships: [],
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({ familyRelationships: [] }),
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
    })

    it('should reject relationships missing required fields', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          familyRelationships: [
            { type: 'Father' }, // missing id and name
          ],
        }),
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('missing required field')
    })

    it('should reject relationships with invalid structure (not an array)', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          familyRelationships: 'not-an-array',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('must be an array')
    })

    it('should sanitize relationship name for XSS', async () => {
      const relationships = [
        {
          id: 'rel-1',
          type: 'Mother',
          name: '<script>alert("XSS")</script>Mary',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
      ]

      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: TEST_USER_UUID,
          displayName: 'Test User',
          familyRelationships: [{ ...relationships[0], name: 'scriptalertXSS/scriptMary' }],
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({ familyRelationships: relationships }),
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)

      // Verify sanitization in UpdateCommand
      const updateCalls = ddbMock.commandCalls(UpdateCommand)
      const lastCall = updateCalls[updateCalls.length - 1]
      const values = lastCall.args[0].input.ExpressionAttributeValues

      const savedRelationships = values[':familyRelationships']
      expect(savedRelationships[0].name).not.toContain('<script>')
      expect(savedRelationships[0].name).not.toContain('</script>')
    })

    it('should sanitize customType for XSS', async () => {
      const relationships = [
        {
          id: 'rel-1',
          type: 'Other',
          customType: '<img src=x onerror="alert(1)">',
          name: 'Test Person',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
      ]

      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: TEST_USER_UUID,
          displayName: 'Test User',
          familyRelationships: [{ ...relationships[0], customType: 'img srcx onerroralert1' }],
        },
      })

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({ familyRelationships: relationships }),
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)

      // Verify sanitization
      const updateCalls = ddbMock.commandCalls(UpdateCommand)
      const lastCall = updateCalls[updateCalls.length - 1]
      const values = lastCall.args[0].input.ExpressionAttributeValues

      const savedRelationships = values[':familyRelationships']
      expect(savedRelationships[0].customType).not.toContain('<img')
      expect(savedRelationships[0].customType).not.toContain('onerror')
    })

    it('should handle profile creation with relationships', async () => {
      const relationships = [
        {
          id: 'rel-1',
          type: 'Sibling',
          name: 'Jane Doe',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
      ]

      ddbMock.on(GetCommand).resolves({ Item: null }) // No existing profile
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: 'New User',
          familyRelationships: relationships,
        }),
        requestContext: {
          authorizer: {
            claims: { sub: TEST_USER_UUID, email: 'test@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)

      // Verify PutCommand was called with relationships
      const putCalls = ddbMock.commandCalls(PutCommand)
      expect(putCalls.length).toBeGreaterThan(0)

      const lastCall = putCalls[putCalls.length - 1]
      const item = lastCall.args[0].input.Item

      expect(item.familyRelationships).toEqual(relationships)
    })
  })

  describe('GET /profile/{userId}/comments', () => {
    it('should return user comment history', async () => {
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

      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
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

      ddbMock.on(GetCommand).resolves({ Item: mockProfile(TEST_USER_UUID) })
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
      expect(body.items[0].isDeleted).toBeUndefined() // handler doesn't return isDeleted field
    })

    it('should return 403 for private profile comments', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: mockProfile(PRIVATE_USER_UUID, { isProfilePrivate: true })
      })
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
