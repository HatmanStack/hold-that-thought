const { handler } = require('../index');
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddbMock = mockClient(DynamoDBDocumentClient);

// Set environment variables
process.env.USER_PROFILES_TABLE = 'test-user-profiles';
process.env.COMMENTS_TABLE = 'test-comments';

beforeEach(() => {
  ddbMock.reset();
});

describe('Profile API Lambda', () => {
  describe('GET /profile/{userId}', () => {
    test('should return user profile', async () => {
      const mockProfile = {
        userId: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        bio: 'Test bio',
        isProfilePrivate: false
      };

      ddbMock.on(GetCommand).resolves({ Item: mockProfile });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'test-user-123' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.userId).toBe('test-user-123');
      expect(body.displayName).toBe('Test User');
    });

    test('should return 404 if profile not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'nonexistent' },
        requestContext: {
          authorizer: {
            claims: { sub: 'requester-123', email: 'requester@example.com' }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Profile not found');
    });

    test('should return 403 for private profile (non-owner)', async () => {
      const mockProfile = {
        userId: 'private-user',
        email: 'private@example.com',
        displayName: 'Private User',
        isProfilePrivate: true
      };

      ddbMock.on(GetCommand).resolves({ Item: mockProfile });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'private-user' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'other-user-123',
              email: 'other@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('This profile is private');
    });

    test('should allow owner to view their private profile', async () => {
      const mockProfile = {
        userId: 'private-user',
        email: 'private@example.com',
        displayName: 'Private User',
        isProfilePrivate: true
      };

      ddbMock.on(GetCommand).resolves({ Item: mockProfile });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'private-user' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'private-user',
              email: 'private@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    test('should allow admin to view private profile', async () => {
      const mockProfile = {
        userId: 'private-user',
        email: 'private@example.com',
        displayName: 'Private User',
        isProfilePrivate: true
      };

      ddbMock.on(GetCommand).resolves({ Item: mockProfile });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'private-user' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'admin-user',
              email: 'admin@example.com',
              'cognito:groups': 'Admins,ApprovedUsers'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('PUT /profile', () => {
    test('should update user profile', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: 'test-user-123',
          email: 'test@example.com',
          displayName: 'Updated Name',
          bio: 'Updated bio',
          updatedAt: '2025-01-15T10:00:00.000Z'
        }
      });

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: 'Updated Name',
          bio: 'Updated bio'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.displayName).toBe('Updated Name');
    });

    test('should return 400 for bio too long', async () => {
      const longBio = 'a'.repeat(501);

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          bio: longBio
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Bio must be 500 characters or less');
    });

    test('should return 400 for displayName too long', async () => {
      const longName = 'a'.repeat(101);

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: longName
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Display name must be 100 characters or less');
    });

    test('should sanitize XSS payloads in bio and displayName', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          userId: 'test-user-123',
          email: 'test@example.com',
          displayName: 'alert(XSS)',
          bio: 'scriptalert(XSS)/script',
          updatedAt: '2025-01-15T10:00:00.000Z'
        }
      });

      const event = {
        httpMethod: 'PUT',
        resource: '/profile',
        body: JSON.stringify({
          displayName: '<script>alert("XSS")</script>',
          bio: '<script>alert("XSS")</script>'
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Verify UpdateCommand was called with sanitized values
      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);

      const lastCall = updateCalls[updateCalls.length - 1];
      const values = lastCall.args[0].input.ExpressionAttributeValues;

      // HTML tags should be stripped
      expect(values[':displayName']).not.toContain('<script>');
      expect(values[':displayName']).not.toContain('</script>');
      expect(values[':bio']).not.toContain('<script>');
      expect(values[':bio']).not.toContain('</script>');
    });
  });

  describe('GET /profile/{userId}/comments', () => {
    test('should return user comment history', async () => {
      const mockProfile = {
        userId: 'test-user-123',
        email: 'test@example.com',
        isProfilePrivate: false
      };

      const mockComments = [
        {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
          userId: 'test-user-123',
          commentText: 'Great letter!',
          isDeleted: false
        },
        {
          itemId: '/2016/summer',
          commentId: '2025-01-14T09:00:00.000Z#def',
          userId: 'test-user-123',
          commentText: 'Love this!',
          isDeleted: false
        }
      ];

      ddbMock.on(GetCommand).resolves({ Item: mockProfile });
      ddbMock.on(QueryCommand).resolves({ Items: mockComments });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: 'test-user-123' },
        queryStringParameters: { limit: '50' },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
      expect(body.items[0].commentText).toBe('Great letter!');
    });

    test('should filter out deleted comments', async () => {
      const mockProfile = {
        userId: 'test-user-123',
        email: 'test@example.com',
        isProfilePrivate: false
      };

      const mockComments = [
        {
          itemId: '/2015/christmas',
          commentId: '2025-01-15T10:00:00.000Z#abc',
          userId: 'test-user-123',
          commentText: 'Great letter!',
          isDeleted: false
        },
        {
          itemId: '/2016/summer',
          commentId: '2025-01-14T09:00:00.000Z#def',
          userId: 'test-user-123',
          commentText: 'Deleted comment',
          isDeleted: true
        }
      ];

      ddbMock.on(GetCommand).resolves({ Item: mockProfile });
      ddbMock.on(QueryCommand).resolves({ Items: mockComments });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: 'test-user-123' },
        queryStringParameters: {},
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].isDeleted).toBe(false);
    });

    test('should return 403 for private profile comments', async () => {
      const mockProfile = {
        userId: 'private-user',
        email: 'private@example.com',
        isProfilePrivate: true
      };

      ddbMock.on(GetCommand).resolves({ Item: mockProfile });

      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}/comments',
        pathParameters: { userId: 'private-user' },
        queryStringParameters: {},
        requestContext: {
          authorizer: {
            claims: {
              sub: 'other-user',
              email: 'other@example.com'
            }
          }
        }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('This profile is private');
    });
  });

  describe('Error handling', () => {
    test('should return 401 if no user context', async () => {
      const event = {
        httpMethod: 'GET',
        resource: '/profile/{userId}',
        pathParameters: { userId: 'test-user' },
        requestContext: {}
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unauthorized');
    });

    test('should return 404 for unknown route', async () => {
      const event = {
        httpMethod: 'POST',
        resource: '/profile/unknown',
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-123',
              email: 'test@example.com'
            }
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
