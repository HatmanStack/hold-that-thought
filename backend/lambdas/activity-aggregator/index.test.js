const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { mockClient } = require('aws-sdk-client-mock')

const ddbMock = mockClient(DynamoDBDocumentClient)

process.env.USER_PROFILES_TABLE = 'test-user-profiles'

const { handler } = require('./index')

beforeEach(() => {
  ddbMock.reset()
})

describe('activity-aggregator handler', () => {
  it('processes INSERT event for comments table and increments comment count', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Comments/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              userId: { S: 'user-123' },
              commentId: { S: 'comment-456' },
              commentText: { S: 'Test comment' },
            },
          },
        },
      ],
    }

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const calls = ddbMock.commandCalls(UpdateCommand)
    expect(calls.length).toBe(2)
    expect(calls[0].args[0].input.UpdateExpression).toContain('commentCount')
    expect(calls[1].args[0].input.UpdateExpression).toContain('lastActive')
  })

  it('processes INSERT event for messages table and updates lastActive', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Messages/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              senderId: { S: 'user-123' },
              messageText: { S: 'Test message' },
            },
          },
        },
      ],
    }

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const calls = ddbMock.commandCalls(UpdateCommand)
    expect(calls.length).toBe(1)
    expect(calls[0].args[0].input.UpdateExpression).toContain('lastActive')
  })

  it('processes INSERT event for reactions table and updates lastActive', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Reactions/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              userId: { S: 'user-123' },
              commentId: { S: 'comment-456' },
              reactionType: { S: 'like' },
            },
          },
        },
      ],
    }

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const calls = ddbMock.commandCalls(UpdateCommand)
    expect(calls.length).toBe(1)
    expect(calls[0].args[0].input.UpdateExpression).toContain('lastActive')
  })

  it('continues processing remaining records if one fails', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejectsOnce(new Error('DynamoDB error'))
      .resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Comments/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              userId: { S: 'user-fail' },
              commentId: { S: 'comment-1' },
              commentText: { S: 'Comment 1' },
            },
          },
        },
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Messages/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              senderId: { S: 'user-success' },
              messageText: { S: 'Message 2' },
            },
          },
        },
      ],
    }

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
  })

  it('extracts table name from ARN correctly', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-west-2:987654321:table/prod-comments-table/stream/2024-06-15',
          dynamodb: {
            NewImage: {
              userId: { S: 'user-123' },
              commentId: { S: 'comment-789' },
              commentText: { S: 'Another comment' },
            },
          },
        },
      ],
    }

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
  })

  it('ignores non-INSERT events', async () => {
    const event = {
      Records: [
        {
          eventName: 'MODIFY',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Comments/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              userId: { S: 'user-123' },
            },
          },
        },
      ],
    }

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const calls = ddbMock.commandCalls(UpdateCommand)
    expect(calls.length).toBe(0)
  })

  it('skips comment-reactions table for comment count increment', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought-Comment-Reactions/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              userId: { S: 'user-123' },
              commentId: { S: 'comment-456' },
              reactionType: { S: 'like' },
            },
          },
        },
      ],
    }

    const result = await handler(event)

    expect(result.statusCode).toBe(200)
    const calls = ddbMock.commandCalls(UpdateCommand)
    expect(calls.length).toBe(1)
    expect(calls[0].args[0].input.UpdateExpression).toContain('lastActive')
    expect(calls[0].args[0].input.UpdateExpression).not.toContain('commentCount')
  })
})
