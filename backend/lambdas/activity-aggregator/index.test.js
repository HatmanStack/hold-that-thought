const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { mockClient } = require('aws-sdk-client-mock')

const ddbMock = mockClient(DynamoDBDocumentClient)

process.env.USER_PROFILES_TABLE = 'test-user-profiles'

const { handler } = require('./index')

beforeEach(() => {
  ddbMock.reset()
})

describe('activity-aggregator handler', () => {
  it('processes INSERT event for COMMENT entityType and increments comment count', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              entityType: { S: 'COMMENT' },
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
    // Verify correct key structure (single-table design)
    expect(calls[0].args[0].input.Key).toEqual({ PK: 'USER#user-123', SK: 'PROFILE' })
    expect(calls[0].args[0].input.UpdateExpression).toContain('commentCount')
    expect(calls[1].args[0].input.Key).toEqual({ PK: 'USER#user-123', SK: 'PROFILE' })
    expect(calls[1].args[0].input.UpdateExpression).toContain('lastActive')
  })

  it('processes INSERT event for MESSAGE entityType and updates lastActive', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              entityType: { S: 'MESSAGE' },
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

  it('processes INSERT event for REACTION entityType and updates lastActive', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              entityType: { S: 'REACTION' },
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
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              entityType: { S: 'COMMENT' },
              userId: { S: 'user-fail' },
              commentId: { S: 'comment-1' },
              commentText: { S: 'Comment 1' },
            },
          },
        },
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              entityType: { S: 'MESSAGE' },
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

  it('ignores non-INSERT events', async () => {
    const event = {
      Records: [
        {
          eventName: 'MODIFY',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              entityType: { S: 'COMMENT' },
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

  it('ignores records without entityType', async () => {
    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              userId: { S: 'user-123' },
              someField: { S: 'some value' },
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

  it('ignores COMMENT records without userId', async () => {
    const event = {
      Records: [
        {
          eventName: 'INSERT',
          eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789:table/HoldThatThought/stream/2024-01-01',
          dynamodb: {
            NewImage: {
              entityType: { S: 'COMMENT' },
              commentText: { S: 'Orphan comment' },
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
})
