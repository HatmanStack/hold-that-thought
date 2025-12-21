const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE

// Key builder for user profile (single-table design)
const userProfileKey = (userId) => ({
  PK: `USER#${userId}`,
  SK: 'PROFILE',
})

exports.handler = async (event) => {
  for (const record of event.Records) {
    try {
      if (record.eventName === 'INSERT') {
        await processInsertEvent(record)
      }
    }
    catch (err) {
      console.error(`Error processing record: ${err.message}`)
    }
  }

  return { statusCode: 200, body: 'Activity stats updated' }
}

async function processInsertEvent(record) {
  const newImage = record.dynamodb.NewImage
  const entityType = newImage.entityType?.S

  if (entityType === 'COMMENT') {
    const userId = newImage.userId?.S
    if (userId) {
      await incrementCommentCount(userId)
      await updateLastActive(userId)
    }
  }
  else if (entityType === 'MESSAGE') {
    const senderId = newImage.senderId?.S
    if (senderId) {
      await updateLastActive(senderId)
    }
  }
  else if (entityType === 'REACTION') {
    const userId = newImage.userId?.S
    if (userId) {
      await updateLastActive(userId)
    }
  }
}

async function incrementCommentCount(userId) {
  await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: userProfileKey(userId),
    UpdateExpression: 'ADD commentCount :inc',
    ExpressionAttributeValues: { ':inc': 1 },
  }))
}

async function updateLastActive(userId) {
  await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: userProfileKey(userId),
    UpdateExpression: 'SET lastActive = :now',
    ExpressionAttributeValues: { ':now': new Date().toISOString() },
  }))
}
