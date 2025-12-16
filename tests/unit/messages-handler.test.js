import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, BatchWriteCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb'

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
const s3Mock = mockClient(S3Client)

let handler

beforeAll(async () => {
  // Clear module cache and import fresh
  vi.resetModules()
  const module = await import('../../backend/lambdas/api/index.js')
  handler = module.handler
})

beforeEach(() => {
  ddbMock.reset()
  s3Mock.reset()
})

describe('messages API Lambda', () => {
  describe('POST /messages/conversations', () => {
    it('should create 1-on-1 conversation with sorted user IDs', async () => {
      ddbMock.on(BatchGetCommand).resolves({
        Responses: {
          'test-user-profiles': [
            { userId: 'user-1', displayName: 'User 1' },
            { userId: 'user-2', displayName: 'User 2' },
          ],
        },
      })
      ddbMock.on(GetCommand).resolves({
        Item: { userId: 'user-1', displayName: 'User 1' },
      })
      ddbMock.on(BatchWriteCommand).resolves({})
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/messages/conversations',
        body: JSON.stringify({
          participantIds: ['user-2', 'user-1'],
          messageText: 'Hello!',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.conversationId).toBe('user-1_user-2') // Sorted
      expect(body.conversationType).toBe('direct')
    })

    it('should create group conversation with UUID', async () => {
      ddbMock.on(BatchGetCommand).resolves({
        Responses: {
          'test-user-profiles': [
            { userId: 'user-1', displayName: 'User 1' },
            { userId: 'user-2', displayName: 'User 2' },
            { userId: 'user-3', displayName: 'User 3' },
          ],
        },
      })
      ddbMock.on(GetCommand).resolves({
        Item: { userId: 'user-1', displayName: 'User 1' },
      })
      ddbMock.on(BatchWriteCommand).resolves({})
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/messages/conversations',
        body: JSON.stringify({
          participantIds: ['user-1', 'user-2', 'user-3'],
          conversationTitle: 'Group Chat',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.conversationType).toBe('group')
      expect(body.conversationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
  })

  describe('POST /messages/{conversationId}', () => {
    it('should send message in conversation', async () => {
      const mockMembership = {
        entityType: 'CONVERSATION_MEMBER',
        PK: 'USER#user-1',
        SK: 'CONV#user-1_user-2',
        userId: 'user-1',
        conversationId: 'user-1_user-2',
        conversationType: 'direct',
        participantIds: ['user-1', 'user-2'],
      }

      const mockProfile = {
        entityType: 'USER_PROFILE',
        userId: 'user-1',
        displayName: 'User 1',
      }

      ddbMock.on(GetCommand)
        .resolvesOnce({ Item: mockMembership }) // Member check
        .resolvesOnce({ Item: mockProfile }) // Sender name
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/messages/{conversationId}',
        pathParameters: { conversationId: 'user-1_user-2' },
        body: JSON.stringify({
          messageText: 'Hello there!',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.messageText).toBe('Hello there!')
      expect(body.senderId).toBe('user-1')
    })

    it('should return 403 if not a participant', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })

      const event = {
        httpMethod: 'POST',
        resource: '/messages/{conversationId}',
        pathParameters: { conversationId: 'other-conv' },
        body: JSON.stringify({
          messageText: 'Hello',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('not a participant')
    })
  })

  describe('GET /messages/conversations', () => {
    it('should list user conversations', async () => {
      const mockConversations = [
        {
          entityType: 'CONVERSATION_MEMBER',
          userId: 'user-1',
          conversationId: 'user-1_user-2',
          conversationType: 'direct',
          lastMessageAt: '2025-01-15T12:00:00.000Z',
          unreadCount: 2,
        },
      ]

      ddbMock.on(QueryCommand).resolves({ Items: mockConversations })

      const event = {
        httpMethod: 'GET',
        resource: '/messages/conversations',
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.conversations).toHaveLength(1)
      expect(body.conversations[0].unreadCount).toBe(2)
    })
  })

  describe('PUT /messages/{conversationId}/read', () => {
    it('should mark conversation as read', async () => {
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'PUT',
        resource: '/messages/{conversationId}/read',
        pathParameters: { conversationId: 'user-1_user-2' },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('marked as read')
    })
  })

  describe('error handling', () => {
    it('should return 401 if no user context', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/messages/conversations',
        requestContext: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Unauthorized')
    })
  })
})
