const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE;

exports.handler = async (event) => {
  for (const record of event.Records) {
    try {
      if (record.eventName === 'INSERT') {
        await processInsertEvent(record);
      }
    } catch (err) {
      console.error(`Error processing record: ${err.message}`);
    }
  }

  return { statusCode: 200, body: 'Activity stats updated' };
};

async function processInsertEvent(record) {
  const tableName = record.eventSourceARN.split(':table/')[1].split('/')[0];
  const newImage = record.dynamodb.NewImage;

  if (tableName.toLowerCase().includes('comment') && !tableName.toLowerCase().includes('reaction')) {
    const userId = newImage.userId.S;
    await incrementCommentCount(userId);
    await updateLastActive(userId);
  } else if (tableName.toLowerCase().includes('message')) {
    const senderId = newImage.senderId?.S;
    if (senderId) {
      await updateLastActive(senderId);
    }
  } else if (tableName.toLowerCase().includes('reaction')) {
    const userId = newImage.userId.S;
    await updateLastActive(userId);
  }
}

async function incrementCommentCount(userId) {
  await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { userId },
    UpdateExpression: 'ADD commentCount :inc',
    ExpressionAttributeValues: { ':inc': 1 }
  }));
}

async function updateLastActive(userId) {
  await docClient.send(new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { userId },
    UpdateExpression: 'SET lastActive = :now',
    ExpressionAttributeValues: { ':now': new Date().toISOString() }
  }));
}
