const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')

const dynamoClient = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const sesClient = new SESClient({})

const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@holdthatthought.family'
const BASE_URL = process.env.BASE_URL || 'https://holdthatthought.family'

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

  return { statusCode: 200, body: 'Notifications processed' }
}

async function processInsertEvent(record) {
  const tableName = record.eventSourceARN.split(':table/')[1].split('/')[0]
  const newImage = record.dynamodb.NewImage

  if (tableName.toLowerCase().includes('comment') && !tableName.toLowerCase().includes('reaction')) {
    processCommentNotification(newImage)
  }
  else if (tableName.toLowerCase().includes('reaction')) {
    processReactionNotification(newImage)
  }
  else if (tableName.toLowerCase().includes('message')) {
    processMessageNotification(newImage)
  }
}

function processCommentNotification(newImage) {
  const itemId = newImage.itemId?.S
  const commentId = newImage.commentId?.S
  const userId = newImage.userId?.S
  const userName = newImage.userName?.S || 'Someone'
  const commentText = newImage.commentText?.S
  const itemTitle = newImage.itemTitle?.S || 'a letter'
}

function processReactionNotification(newImage) {
  const commentId = newImage.commentId?.S
  const userId = newImage.userId?.S
}

function processMessageNotification(newImage) {
  const conversationId = newImage.conversationId?.S
  const senderId = newImage.senderId?.S
  const senderName = newImage.senderName?.S || 'Someone'
  const messageText = newImage.messageText?.S
}

function maskEmail(email) {
  if (!email || typeof email !== 'string')
    return '[invalid]'
  const parts = email.split('@')
  if (parts.length !== 2)
    return '[invalid]'
  const name = parts[0]
  const masked = name.length > 2 ? `${name.slice(0, 2)}***` : '***'
  return `${masked}@${parts[1]}`
}

exports.sendEmail = async function sendEmail(toEmail, subject, bodyHtml) {
  try {
    await sesClient.send(new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: bodyHtml } },
      },
    }))
    return true
  }
  catch (err) {
    console.error(`Error sending email to ${maskEmail(toEmail)}: ${err.message}`)
    return false
  }
}

function shouldSendNotification(userId, eventType) {
  return true
}
