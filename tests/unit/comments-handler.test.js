// Import SDK from root node_modules
const { mockClient } = require('aws-sdk-client-mock')
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

// Create mock BEFORE setting env vars or importing handler
const ddbMock = mockClient(DynamoDBDocumentClient)

// Set env vars BEFORE importing handler
process.env.TABLE_NAME = 'test-table'
process.env.S3_BUCKET = 'test-bucket'

// Import handler after mock is created
const { handler } = require('../../backend/lambdas/api/index')

beforeEach(() => {
  ddbMock.reset()
})

describe('comments API Lambda', () => {
  describe('gET /comments/{itemId}', () => {
    it('should return paginated comments', async () => {
      const mockComments = [
        {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
          userId: 'user-1',
          commentText: 'Great letter!',
          isDeleted: false,
        },
        {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T11:00:00.000Z#def',
          userId: 'user-2',
          commentText: 'Love it!',
          isDeleted: false,
        },
      ]

      ddbMock.on(QueryCommand).resolves({ Items: mockComments })

      const event = {
        httpMethod: 'GET',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
        queryStringParameters: { limit: '50' },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
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
          commentText: 'Visible',
          isDeleted: false,
        },
        {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T11:00:00.000Z#def',
          commentText: 'Deleted',
          isDeleted: true,
        },
      ]

      ddbMock.on(QueryCommand).resolves({ Items: mockComments })

      const event = {
        httpMethod: 'GET',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
        queryStringParameters: {},
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.items).toHaveLength(1)
      expect(body.items[0].commentText).toBe('Visible')
    })

    it('should return 400 if itemId missing', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/comments/{itemId}',
        pathParameters: {},
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Missing itemId')
    })
  })

  describe('pOST /comments/{itemId}', () => {
    it('should create comment with denormalized user data', async () => {
      const mockProfile = {
        userId: 'user-1',
        displayName: 'John Doe',
        profilePhotoUrl: 'https://example.com/photo.jpg',
      }

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
        body: JSON.stringify({
          commentText: 'Great letter!',
          itemType: 'letter',
          itemTitle: 'Christmas Letter 2015',
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
      expect(body.commentText).toBe('Great letter!')
      expect(body.userName).toBe('John Doe')
      expect(body.userPhotoUrl).toBe('https://example.com/photo.jpg')
      expect(body.itemId).toBe('/2015/christmas')
      expect(body.userId).toBe('user-1')
    })

    it('should sanitize HTML in comment text', async () => {
      const mockProfile = {
        userId: 'user-1',
        displayName: 'John Doe',
      }

      ddbMock.on(GetCommand).resolves({ Item: mockProfile })
      ddbMock.on(PutCommand).resolves({})

      const event = {
        httpMethod: 'POST',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
        body: JSON.stringify({
          commentText: '<script>alert("xss")</script>Hello <b>world</b>!',
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
      expect(body.commentText).toBe('Hello world!')
      expect(body.commentText).not.toContain('<script>')
      expect(body.commentText).not.toContain('<b>')
    })

    it('should return 400 if comment text too long', async () => {
      const longText = 'a'.repeat(2001)

      const event = {
        httpMethod: 'POST',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
        body: JSON.stringify({
          commentText: longText,
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('2000 characters or less')
    })

    it('should return 400 if comment text missing', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
        body: JSON.stringify({}),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Missing or invalid commentText')
    })

    it('should return 400 if sanitized text is empty', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
        body: JSON.stringify({
          commentText: '<script></script>   ',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('cannot be empty after sanitization')
    })
  })

  describe('pUT /comments/{itemId}/{commentId}', () => {
    it('should edit own comment', async () => {
      const mockComment = {
        itemId: '/2015/christmas',
        commentId: '2025-01-15T10:00:00.000Z#abc',
        userId: 'user-1',
        commentText: 'Original text',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: null,
        isEdited: false,
        editHistory: [],
      }

      const updatedComment = {
        ...mockComment,
        commentText: 'Updated text',
        updatedAt: '2025-01-15T11:00:00.000Z',
        isEdited: true,
        editHistory: [{
          text: 'Original text',
          timestamp: '2025-01-15T10:00:00.000Z',
        }],
      }

      ddbMock.on(GetCommand).resolvesOnce({ Item: mockComment }).resolvesOnce({ Item: updatedComment })
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'PUT',
        resource: '/comments/{itemId}/{commentId}',
        pathParameters: {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        body: JSON.stringify({
          commentText: 'Updated text',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.commentText).toBe('Updated text')
      expect(body.isEdited).toBe(true)
      expect(body.editHistory).toHaveLength(1)
    })

    it('should return 403 if editing someone elses comment', async () => {
      const mockComment = {
        itemId: '/2015/christmas',
        commentId: '2025-01-15T10:00:00.000Z#abc',
        userId: 'user-2',
        commentText: 'Original text',
      }

      ddbMock.on(GetCommand).resolves({ Item: mockComment })

      const event = {
        httpMethod: 'PUT',
        resource: '/comments/{itemId}/{commentId}',
        pathParameters: {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        body: JSON.stringify({
          commentText: 'Updated text',
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
      expect(body.error).toContain('only edit your own comments')
    })

    it('should allow admin to edit any comment', async () => {
      const mockComment = {
        itemId: '/2015/christmas',
        commentId: '2025-01-15T10:00:00.000Z#abc',
        userId: 'user-2',
        commentText: 'Original text',
        editHistory: [],
      }

      const updatedComment = {
        ...mockComment,
        commentText: 'Admin edited',
        isEdited: true,
      }

      ddbMock.on(GetCommand).resolvesOnce({ Item: mockComment }).resolvesOnce({ Item: updatedComment })
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'PUT',
        resource: '/comments/{itemId}/{commentId}',
        pathParameters: {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        body: JSON.stringify({
          commentText: 'Admin edited',
        }),
        requestContext: {
          authorizer: {
            claims: {
              'sub': 'admin-user',
              'email': 'admin@example.com',
              'cognito:groups': 'Admins,ApprovedUsers',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
    })

    it('should return 404 if comment not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })

      const event = {
        httpMethod: 'PUT',
        resource: '/comments/{itemId}/{commentId}',
        pathParameters: {
          itemId: '/2015/christmas',
          commentId: 'nonexistent',
        },
        body: JSON.stringify({
          commentText: 'Updated text',
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Comment not found')
    })
  })

  describe('dELETE /comments/{itemId}/{commentId}', () => {
    it('should soft delete own comment', async () => {
      const mockComment = {
        itemId: '/2015/christmas',
        commentId: '2025-01-15T10:00:00.000Z#abc',
        userId: 'user-1',
        commentText: 'My comment',
        isDeleted: false,
      }

      ddbMock.on(GetCommand).resolves({ Item: mockComment })
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'DELETE',
        resource: '/comments/{itemId}/{commentId}',
        pathParameters: {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('deleted successfully')
    })

    it('should return 403 if deleting someone elses comment', async () => {
      const mockComment = {
        itemId: '/2015/christmas',
        commentId: '2025-01-15T10:00:00.000Z#abc',
        userId: 'user-2',
        commentText: 'Their comment',
      }

      ddbMock.on(GetCommand).resolves({ Item: mockComment })

      const event = {
        httpMethod: 'DELETE',
        resource: '/comments/{itemId}/{commentId}',
        pathParameters: {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('only delete your own comments')
    })

    it('should allow admin to delete any comment', async () => {
      const mockComment = {
        itemId: '/2015/christmas',
        commentId: '2025-01-15T10:00:00.000Z#abc',
        userId: 'user-2',
        commentText: 'Any comment',
      }

      ddbMock.on(GetCommand).resolves({ Item: mockComment })
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'DELETE',
        resource: '/comments/{itemId}/{commentId}',
        pathParameters: {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        requestContext: {
          authorizer: {
            claims: {
              'sub': 'admin-user',
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

  describe('dELETE /admin/comments/{commentId}', () => {
    it('should allow admin to delete any comment', async () => {
      ddbMock.on(UpdateCommand).resolves({})

      const event = {
        httpMethod: 'DELETE',
        resource: '/admin/comments/{commentId}',
        pathParameters: {
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        body: JSON.stringify({
          itemId: '/2015/christmas',
        }),
        requestContext: {
          authorizer: {
            claims: {
              'sub': 'admin-user',
              'email': 'admin@example.com',
              'cognito:groups': 'Admins,ApprovedUsers',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('deleted by admin')
    })

    it('should return 403 if not admin', async () => {
      const event = {
        httpMethod: 'DELETE',
        resource: '/admin/comments/{commentId}',
        pathParameters: {
          commentId: '2025-01-15T10:00:00.000Z#abc',
        },
        body: JSON.stringify({
          itemId: '/2015/christmas',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user-1',
              email: 'user1@example.com',
            },
          },
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Admin access required')
    })
  })

  describe('error handling', () => {
    it('should return 401 if no user context', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/comments/{itemId}',
        pathParameters: { itemId: '/2015/christmas' },
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
        resource: '/comments/unknown',
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'user1@example.com' },
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
