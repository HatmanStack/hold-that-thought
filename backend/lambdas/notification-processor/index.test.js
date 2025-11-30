const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ddbMock = mockClient(DynamoDBDocumentClient);
const sesMock = mockClient(SESClient);

process.env.USER_PROFILES_TABLE = 'test-user-profiles';
process.env.SES_FROM_EMAIL = 'test@holdthatthought.family';
process.env.BASE_URL = 'https://test.holdthatthought.family';

const { handler } = require('./index');

beforeEach(() => {
  ddbMock.reset();
  sesMock.reset();
});

describe('notification-processor handler', () => {
  it('processes INSERT event for comments table', async () => {
    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Comments/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              itemId: { S: 'item-123' },
              commentId: { S: 'comment-456' },
              userId: { S: 'user-789' },
              userName: { S: 'Test User' },
              commentText: { S: 'This is a test comment' },
              itemTitle: { S: 'Test Letter' }
            }
          }
        }
      ]
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });

  it('processes INSERT event for reactions table', async () => {
    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Reactions/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              commentId: { S: 'comment-456' },
              userId: { S: 'user-789' },
              reactionType: { S: 'like' }
            }
          }
        }
      ]
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });

  it('processes INSERT event for messages table', async () => {
    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Messages/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              conversationId: { S: 'conv-123' },
              senderId: { S: 'user-789' },
              senderName: { S: 'Test Sender' },
              messageText: { S: 'This is a test message' }
            }
          }
        }
      ]
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });

  it('sends email via SES', async () => {
    sesMock.on(SendEmailCommand).resolves({ MessageId: 'test-message-id' });

    const { sendEmail } = require('./index');
    const result = await sendEmail('recipient@example.com', 'Test Subject', '<p>Test body</p>');

    expect(result).toBe(true);
    const calls = sesMock.commandCalls(SendEmailCommand);
    expect(calls.length).toBe(1);
    expect(calls[0].args[0].input.Destination.ToAddresses).toContain('recipient@example.com');
    expect(calls[0].args[0].input.Message.Subject.Data).toBe('Test Subject');
  });

  it('handles SES email failure gracefully', async () => {
    sesMock.on(SendEmailCommand).rejects(new Error('SES error'));

    const { sendEmail } = require('./index');
    const result = await sendEmail('recipient@example.com', 'Test Subject', '<p>Test body</p>');

    expect(result).toBe(false);
  });

  it('continues processing remaining records if one fails', async () => {
    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Invalid/stream/2024-01-01',
          dynamodb: {
            NewImage: {}
          }
        },
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Messages/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              conversationId: { S: 'conv-123' },
              senderId: { S: 'user-789' },
              senderName: { S: 'Test Sender' },
              messageText: { S: 'This is a test message' }
            }
          }
        }
      ]
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });

  it('ignores non-INSERT events', async () => {
    const event = {
      Records: [
        {
          eventName: 'MODIFY',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Comments/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              commentId: { S: 'comment-456' }
            }
          }
        }
      ]
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });

  it('handles missing optional fields gracefully', async () => {
    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Comments/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              itemId: { S: 'item-123' },
              commentId: { S: 'comment-456' },
              userId: { S: 'user-789' },
              commentText: { S: 'Test comment' }
            }
          }
        }
      ]
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });
});
