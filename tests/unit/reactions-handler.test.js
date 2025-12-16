import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

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
  // Clear module cache and import fresh
  vi.resetModules()
  const module = await import('../../backend/lambdas/api/index.js')
  handler = module.handler
})

beforeEach(() => {
  ddbMock.reset()
})

describe('reactions API Lambda', () => {
  describe('POST /reactions/{commentId}', () => {
    it('should add reaction if not exists', async () => {
      // Mock: reaction doesn't exist
      ddbMock.on(GetCommand).resolves({ Item: undefined })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

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
      // Mock: reaction exists
      const existingReaction = {
        commentId: 'comment-123',
        userId: 'user-123',
        reactionType: 'like',
        createdAt: '2025-01-15T10:00:00.000Z',
      }

      ddbMock.on(GetCommand).resolves({ Item: existingReaction })
      ddbMock.on(DeleteCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

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

    it('should toggle reaction on repeated calls', async () => {
      ddbMock.reset()

      // First call: reaction doesn't exist, add it
      ddbMock.on(GetCommand).resolvesOnce({ Item: undefined })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      let response = await handler(event)
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).liked).toBe(true)

      // Second call: reaction exists, remove it
      ddbMock.reset()
      ddbMock.on(GetCommand).resolvesOnce({
        Item: {
          commentId: 'comment-123',
          userId: 'user-123',
          reactionType: 'like',
        },
      })
      ddbMock.on(DeleteCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

      response = await handler(event)
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).liked).toBe(false)
    })

    it('should return 400 if commentId missing', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: {},
        body: JSON.stringify({ itemId: '/2015/christmas' }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Missing commentId')
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

    it('should update reactionCount in Comments table when adding', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

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

      // Verify UpdateCommand was called to increment reactionCount
      const updateCalls = ddbMock.commandCalls(UpdateCommand)
      expect(updateCalls.length).toBe(1)
      expect(updateCalls[0].args[0].input.UpdateExpression).toContain('reactionCount')
      expect(updateCalls[0].args[0].input.ExpressionAttributeValues[':increment']).toBe(1)
    })

    it('should update reactionCount in Comments table when removing', async () => {
      const existingReaction = {
        commentId: 'comment-123',
        userId: 'user-123',
        reactionType: 'like',
      }

      ddbMock.on(GetCommand).resolves({ Item: existingReaction })
      ddbMock.on(DeleteCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      await handler(event)

      // Verify UpdateCommand was called to decrement reactionCount
      const updateCalls = ddbMock.commandCalls(UpdateCommand)
      expect(updateCalls.length).toBe(1)
      expect(updateCalls[0].args[0].input.UpdateExpression).toContain('reactionCount')
      expect(updateCalls[0].args[0].input.ExpressionAttributeValues[':decrement']).toBe(-1)
    })
  })

  describe('GET /reactions/{commentId}', () => {
    it('should return all reactions for a comment', async () => {
      const mockReactions = [
        {
          commentId: 'comment-123',
          userId: 'user-1',
          reactionType: 'like',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
        {
          commentId: 'comment-123',
          userId: 'user-2',
          reactionType: 'like',
          createdAt: '2025-01-15T11:00:00.000Z',
        },
      ]

      ddbMock.on(QueryCommand).resolves({ Items: mockReactions })

      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
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
      expect(body.reactions[0].userId).toBe('user-1')
    })

    it('should return empty array if no reactions', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })

      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
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

    it('should return 400 if commentId missing', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: {},
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Missing commentId')
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
        httpMethod: 'DELETE',
        resource: '/reactions/unknown',
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' },
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
