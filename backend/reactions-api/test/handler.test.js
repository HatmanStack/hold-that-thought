const { handler } = require('../index');
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddbMock = mockClient(DynamoDBDocumentClient);

// Set environment variables
process.env.COMMENT_REACTIONS_TABLE = 'test-comment-reactions';
process.env.COMMENTS_TABLE = 'test-comments';

beforeEach(() => {
  ddbMock.reset();
});

describe('Reactions API Lambda', () => {
  describe('POST /reactions/{commentId}', () => {
    test('should add reaction if not exists', async () => {
      // Mock: reaction doesn't exist
      ddbMock.on(GetCommand).resolves({ Item: undefined });
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
          reactionType: 'like'
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.liked).toBe(true);
      expect(body.message).toContain('added');
    });

    test('should remove reaction if exists', async () => {
      // Mock: reaction exists
      const existingReaction = {
        commentId: 'comment-123',
        userId: 'user-123',
        reactionType: 'like',
        createdAt: '2025-01-15T10:00:00.000Z'
      };

      ddbMock.on(GetCommand).resolves({ Item: existingReaction });
      ddbMock.on(DeleteCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
          reactionType: 'like'
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.liked).toBe(false);
      expect(body.message).toContain('removed');
    });

    test('should toggle reaction on repeated calls', async () => {
      ddbMock.reset();

      // First call: reaction doesn't exist, add it
      ddbMock.on(GetCommand).resolvesOnce({ Item: undefined });
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas'
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      let response = await handler(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).liked).toBe(true);

      // Second call: reaction exists, remove it
      ddbMock.reset();
      ddbMock.on(GetCommand).resolvesOnce({
        Item: {
          commentId: 'comment-123',
          userId: 'user-123',
          reactionType: 'like'
        }
      });
      ddbMock.on(DeleteCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({});

      response = await handler(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).liked).toBe(false);
    });

    test('should return 400 if commentId missing', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: {},
        body: JSON.stringify({ itemId: '/2015/christmas' }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing commentId');
    });

    test('should return 400 if itemId missing', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({}),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing itemId');
    });

    test('should update reactionCount in Comments table when adding', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas',
          reactionType: 'like'
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      await handler(event);

      // Verify UpdateCommand was called to increment reactionCount
      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0].args[0].input.UpdateExpression).toContain('reactionCount');
      expect(updateCalls[0].args[0].input.ExpressionAttributeValues[':increment']).toBe(1);
    });

    test('should update reactionCount in Comments table when removing', async () => {
      const existingReaction = {
        commentId: 'comment-123',
        userId: 'user-123',
        reactionType: 'like'
      };

      ddbMock.on(GetCommand).resolves({ Item: existingReaction });
      ddbMock.on(DeleteCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({
          itemId: '/2015/christmas'
        }),
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      await handler(event);

      // Verify UpdateCommand was called to decrement reactionCount
      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0].args[0].input.UpdateExpression).toContain('reactionCount');
      expect(updateCalls[0].args[0].input.ExpressionAttributeValues[':decrement']).toBe(-1);
    });
  });

  describe('GET /reactions/{commentId}', () => {
    test('should return all reactions for a comment', async () => {
      const mockReactions = [
        {
          commentId: 'comment-123',
          userId: 'user-1',
          reactionType: 'like',
          createdAt: '2025-01-15T10:00:00.000Z'
        },
        {
          commentId: 'comment-123',
          userId: 'user-2',
          reactionType: 'like',
          createdAt: '2025-01-15T11:00:00.000Z'
        }
      ];

      ddbMock.on(QueryCommand).resolves({ Items: mockReactions });

      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.commentId).toBe('comment-123');
      expect(body.count).toBe(2);
      expect(body.reactions).toHaveLength(2);
      expect(body.reactions[0].userId).toBe('user-1');
    });

    test('should return empty array if no reactions', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.count).toBe(0);
      expect(body.reactions).toEqual([]);
    });

    test('should return 400 if commentId missing', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/reactions/{commentId}',
        pathParameters: {},
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing commentId');
    });
  });

  describe('Error handling', () => {
    test('should return 401 if no user context', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/reactions/{commentId}',
        pathParameters: { commentId: 'comment-123' },
        body: JSON.stringify({ itemId: '/2015/christmas' }),
        requestContext: {}
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unauthorized');
    });

    test('should return 404 for unknown route', async () => {
      const event = {
        httpMethod: 'DELETE',
        resource: '/reactions/unknown',
        requestContext: {
          authorizer: {
            claims: { sub: 'user-123', email: 'user@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Route not found');
    });
  });
});
