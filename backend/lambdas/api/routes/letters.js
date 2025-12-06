const { GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { docClient, TABLE_NAME, ARCHIVE_BUCKET, PREFIX, keys, successResponse, errorResponse } = require('../utils')

const s3Client = new S3Client({})

// Date validation helper
function isValidDate(date) {
  if (!date || typeof date !== 'string') return false
  const dateRegex = /^\d{4}-\d{2}-\d{2}(-[a-z0-9-]+)?$/
  return dateRegex.test(date)
}

async function handle(event, context) {
  const { requesterId } = context
  const method = event.httpMethod
  const resource = event.resource

  if (method === 'GET' && resource === '/letters') {
    return await listLetters(event)
  }
  if (method === 'GET' && resource === '/letters/{date}') {
    return await getLetter(event)
  }
  if (method === 'PUT' && resource === '/letters/{date}') {
    if (!requesterId) {
      return errorResponse(401, 'Authentication required')
    }
    return await updateLetter(event, requesterId)
  }
  if (method === 'GET' && resource === '/letters/{date}/versions') {
    return await getVersions(event)
  }
  if (method === 'POST' && resource === '/letters/{date}/revert') {
    if (!requesterId) {
      return errorResponse(401, 'Authentication required')
    }
    return await revertToVersion(event, requesterId)
  }
  if (method === 'GET' && resource === '/letters/{date}/pdf') {
    return await getPdfUrl(event)
  }

  return errorResponse(404, 'Route not found')
}

async function listLetters(event) {
  const limit = parseInt(event.queryStringParameters?.limit) || 50
  const cursor = event.queryStringParameters?.cursor

  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'LETTERS' },
      Limit: limit,
      ScanIndexForward: false, // Newest first
    }

    if (cursor) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString())
    }

    const result = await docClient.send(new QueryCommand(params))

    return successResponse({
      items: (result.Items || []).map(item => ({
        date: item.GSI1SK,
        title: item.title,
        originalTitle: item.originalTitle,
        updatedAt: item.updatedAt,
      })),
      nextCursor: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    })
  } catch (error) {
    console.error('Error listing letters:', error)
    throw error
  }
}

async function getLetter(event) {
  const date = event.pathParameters?.date

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
    }))

    if (!result.Item) {
      return errorResponse(404, 'Letter not found')
    }

    return successResponse({
      date,
      title: result.Item.title,
      originalTitle: result.Item.originalTitle,
      content: result.Item.content,
      pdfKey: result.Item.pdfKey,
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt,
      lastEditedBy: result.Item.lastEditedBy,
      versionCount: result.Item.versionCount || 0,
    })
  } catch (error) {
    console.error('Error getting letter:', { date, error })
    throw error
  }
}

async function updateLetter(event, requesterId) {
  const date = event.pathParameters?.date

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }
  const { content, title } = body

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  if (!content) {
    return errorResponse(400, 'Content is required')
  }

  try {
    // Get current letter
    const current = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
    }))

    if (!current.Item) {
      return errorResponse(404, 'Letter not found')
    }

    const now = new Date().toISOString()
    const versionNumber = (current.Item.versionCount || 0) + 1

    // Create version of current content
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys.letterVersion(date, now),
        content: current.Item.content,
        title: current.Item.title,
        editedBy: current.Item.lastEditedBy,
        editedAt: current.Item.updatedAt,
        versionNumber: current.Item.versionCount || 0,
        entityType: 'LETTER_VERSION',
      },
    }))

    // Update current letter
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
      UpdateExpression: 'SET content = :content, title = :title, updatedAt = :now, lastEditedBy = :editor, versionCount = :vc',
      ExpressionAttributeValues: {
        ':content': content,
        ':title': title || current.Item.title,
        ':now': now,
        ':editor': requesterId,
        ':vc': versionNumber,
      },
    }))

    return successResponse({
      date,
      title: title || current.Item.title,
      content,
      updatedAt: now,
      versionCount: versionNumber,
    })
  } catch (error) {
    console.error('Error updating letter:', { date, error })
    throw error
  }
}

async function getVersions(event) {
  const date = event.pathParameters?.date

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `${PREFIX.LETTER}${date}`,
        ':prefix': PREFIX.VERSION,
      },
      ScanIndexForward: false, // Newest first
    }))

    return successResponse({
      versions: (result.Items || []).map(v => ({
        timestamp: v.SK.replace(PREFIX.VERSION, ''),
        versionNumber: v.versionNumber,
        editedBy: v.editedBy,
        editedAt: v.editedAt,
      })),
    })
  } catch (error) {
    console.error('Error getting versions:', { date, error })
    throw error
  }
}

async function revertToVersion(event, requesterId) {
  const date = event.pathParameters?.date

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }
  const { versionTimestamp } = body

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  if (!versionTimestamp) {
    return errorResponse(400, 'versionTimestamp is required')
  }

  try {
    // Get the version to revert to
    const version = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letterVersion(date, versionTimestamp),
    }))

    if (!version.Item) {
      return errorResponse(404, 'Version not found')
    }

    // Get current letter for versioning
    const current = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
    }))

    if (!current.Item) {
      return errorResponse(404, 'Letter not found')
    }

    const now = new Date().toISOString()
    const versionNumber = (current.Item.versionCount || 0) + 1

    // Create version of current content before reverting
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys.letterVersion(date, now),
        content: current.Item.content,
        title: current.Item.title,
        editedBy: current.Item.lastEditedBy,
        editedAt: current.Item.updatedAt,
        versionNumber: current.Item.versionCount || 0,
        entityType: 'LETTER_VERSION',
      },
    }))

    // Update current letter with reverted content
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
      UpdateExpression: 'SET content = :content, title = :title, updatedAt = :now, lastEditedBy = :editor, versionCount = :vc',
      ExpressionAttributeValues: {
        ':content': version.Item.content,
        ':title': version.Item.title,
        ':now': now,
        ':editor': requesterId,
        ':vc': versionNumber,
      },
    }))

    return successResponse({
      message: 'Reverted successfully',
      date,
      title: version.Item.title,
      content: version.Item.content,
      updatedAt: now,
      versionCount: versionNumber,
      revertedFrom: versionTimestamp,
    })
  } catch (error) {
    console.error('Error reverting letter:', { date, versionTimestamp, error })
    throw error
  }
}

async function getPdfUrl(event) {
  const date = event.pathParameters?.date

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  try {
    // Get letter to find PDF key
    const letter = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
    }))

    if (!letter.Item || !letter.Item.pdfKey) {
      return errorResponse(404, 'PDF not found')
    }

    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: ARCHIVE_BUCKET,
        Key: letter.Item.pdfKey,
      }),
      { expiresIn: 3600 }
    )

    return successResponse({
      downloadUrl: presignedUrl,
      filename: `${date}.pdf`,
    })
  } catch (error) {
    console.error('Error getting PDF URL:', { date, error })
    throw error
  }
}

module.exports = { handle }
