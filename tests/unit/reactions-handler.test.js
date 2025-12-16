import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'

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

let handler

beforeAll(async () => {
  vi.resetModules()
  const module = await import('../../backend/lambdas/api/index.js')
  handler = module.handler
})

beforeEach(() => {
  ddbMock.reset()
})

// Helper to create a mock comment
const mockComment = (itemId = '/2015/christmas', commentId = 'comment-123') => ({
  PK: `COMMENT#${itemId}`,
  SK: commentId,
  entityType: 'COMMENT',
  itemId,
  commentId,
  commentText: 'Test comment',
  userId: 'author-123',
  reactionCount: 0,
})

// Helper to create a mock reaction
const mockReaction = (commentId = 'comment-123', userId = 'user-123') => ({
  PK: `COMMENT#/2015/christmas`,
  SK: `REACTION#${commentId}#${userId}`,
  entityType: 'REACTION',
  commentId,
  userId,
  reactionType: 'like',
  createdAt: '2025-01-15T10:00:00.000Z',
})

describe('reactions API Lambda', () => {
  describe('POST /reactions/{commentId}', () => {
    it('should add reaction if not exists', async () => {
      // Mock: comment exists, reaction doesn't exist
      ddbMock.on(GetCommand)
        .resolvesOnce({ Item: mockComment() })  // comment lookup
        .resolvesOnce({ Item: undefined })       // reaction lookup
      ddbMock.on(TransactWriteCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
          reactionType: 'like',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.liked).toBe(true)
      expect(body.message).toContain('added')
    })

    it('should remove reaction if exists', async () => {
      // Mock: comment exists, reaction exists
      ddbMock.on(GetCommand)
        .resolvesOnce({ Item: mockComment() })      // comment lookup
        .resolvesOnce({ Item: mockReaction() })     // reaction lookup - exists
      ddbMock.on(TransactWriteCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
          reactionType: 'like',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.liked).toBe(false)
      expect(body.message).toContain('removed')
    })

    it('should return 404 if comment not found', async () => {
      // Mock: comment doesn't exist
      ddbMock.on(GetCommand).resolves({ Item: undefined })

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
          reactionType: 'like',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Comment not found')
    })

    it('should return 400 if itemId missing', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({}),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Missing itemId')
    })

    it('should use TransactWriteCommand for atomic operations', async () => {
      ddbMock.on(GetCommand)
        .resolvesOnce({ Item: mockComment() })
        .resolvesOnce({ Item: undefined })
      ddbMock.on(TransactWriteCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
          reactionType: 'like',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      await handler(event)

      const txCalls = ddbMock.commandCalls(TransactWriteCommand)
      expect(txCalls.length).toBe(1)
    })
  })

  describe('GET /reactions/{commentId}', () => {
    it('should return all reactions for a comment', async () => {
      const mockReactions = [
        { ...mockReaction('comment-123', 'user-1'), entityType: 'REACTION' },
        { ...mockReaction('comment-123', 'user-2'), entityType: 'REACTION' },
      ]

      ddbMock.on(QueryCommand).resolves({ Items: mockReactions })

      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        queryStringParameters: { itemId: '/2015/christmas' },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.commentId).toBe('comment-123')
      expect(body.count).toBe(2)
      expect(body.reactions).toHaveLength(2)
    })

    it('should return empty array if no reactions', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        queryStringParameters: { itemId: '/2015/christmas' },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.count).toBe(0)
      expect(body.reactions).toEqual([])
    })

    it('should return 400 if itemId query param missing', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        queryStringParameters: {},
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Missing itemId')
    })
  })

  describe('error handling', () => {
    it('should return 401 if no user context', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({ itemId: '/2015/christmas' }),
        requestContext: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Unauthorized')
    })

    it('should return 404 for unknown route', async () => {
      const event = {
        httpMethod: 'PATCH',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(404)
    })
  })
})
