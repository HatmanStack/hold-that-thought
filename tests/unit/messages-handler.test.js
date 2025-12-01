// Set environment variables BEFORE importing handler
process.env.USER_PROFILES_TABLE = 'test-user-profiles'
process.env.MESSAGES_TABLE = 'test-messages'
process.env.CONVERSATION_MEMBERS_TABLE = 'test-conversation-members'
process.env.BUCKET_NAME = 'test-bucket'
process.env.AWS_REGION = 'us-east-1'

// Import SDK from the SAME location as the Lambda handler uses
const { S3Client } = require('../../backend/lambdas/messages-api/node_modules/@aws-sdk/client-s3')
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, BatchWriteCommand, BatchGetCommand } = require('../../backend/lambdas/messages-api/node_modules/@aws-sdk/lib-dynamodb')
const { mockClient } = require('aws-sdk-client-mock')

// Create mocks BEFORE importing handler (handler creates clients at module load)
const ddbMock = mockClient(DynamoDBDocumentClient)
const s3Mock = mockClient(S3Client)

// NOW import handler (will use the mocked clients)
const { handler } = require('../../backend/lambdas/messages-api/index')

beforeEach(() => {
  ddbMock.reset()
  s3Mock.reset()
})

describe('messages API Lambda', () => {
  describe('pOST /messages/conversations', () => {
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
      expect(body.conversationId).toBe('user-1#user-2') // Sorted
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

  describe('pOST /messages/conversations/{conversationId}', () => {
    it('should send message in conversation', async () => {
      const mockConversation = {
        userId: 'user-1',
        conversationId: 'user-1#user-2',
        conversationType: 'direct',
        participantIds: new Set(['user-1', 'user-2']),
      }

      ddbMock.on(GetCommand)
        .resolvesOnce({ Item: mockConversation }) // Member check
        .resolvesOnce({ Item: { userId: 'user-1', displayName: 'User 1' } }) // Sender name
      ddbMock.on(PutCommand).resolves({})
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/messages/conversations/{conversationId}',
        pathParameters: { conversationId: 'user-1#user-2' },
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
        resource: '/messages/conversations/{conversationId}',
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

  describe('gET /messages/conversations', () => {
    it('should list user conversations', async () => {
      const mockConversations = [
        {
          userId: 'user-1',
          conversationId: 'user-1#user-2',
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

  describe('pUT /messages/conversations/{conversationId}/read', () => {
    it('should mark conversation as read', async () => {
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'PUT',
        resource: '/messages/conversations/{conversationId}/read',
        pathParameters: { conversationId: 'user-1#user-2' },
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
