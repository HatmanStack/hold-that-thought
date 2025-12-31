/**
 * Letters route handler
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import type { RequestContext } from '../types'
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, type QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { docClient, TABLE_NAME, ARCHIVE_BUCKET } from '../lib/database'
import { keys } from '../lib/keys'
import { successResponse, errorResponse } from '../lib/responses'
import { log } from '../lib/logger'

const s3Client = new S3Client({})

function isValidDate(date: string | undefined): boolean {
  if (!date || typeof date !== 'string') return false
  const dateRegex = /^\d{4}-\d{2}-\d{2}(-[a-z0-9-]+)?$/
  return dateRegex.test(date)
}

/**
 * Main letters route handler
 */
export async function handle(
  event: APIGatewayProxyEvent,
  context: RequestContext
): Promise<APIGatewayProxyResult> {
  const { requesterId } = context
  const method = event.httpMethod
  const resource = event.resource
  const normalizedResource = resource.replace(/^\/v1/, '')

  if (method === 'GET' && normalizedResource === '/letters') {
    return listLetters(event)
  }

  if (method === 'GET' && normalizedResource === '/letters/{date}') {
    return getLetter(event)
  }

  if (method === 'PUT' && normalizedResource === '/letters/{date}') {
    if (!requesterId) {
      return errorResponse(401, 'Authentication required')
    }
    return updateLetter(event, requesterId)
  }

  if (method === 'GET' && normalizedResource === '/letters/{date}/versions') {
    return getVersions(event)
  }

  if (method === 'POST' && normalizedResource === '/letters/{date}/revert') {
    if (!requesterId) {
      return errorResponse(401, 'Authentication required')
    }
    return revertToVersion(event, requesterId)
  }

  if (method === 'GET' && normalizedResource === '/letters/{date}/pdf') {
    return getPdfUrl(event)
  }

  return errorResponse(404, 'Route not found')
}

async function listLetters(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10)
  const cursor = event.queryStringParameters?.cursor

  try {
    const params: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'LETTERS' },
      Limit: limit,
      ScanIndexForward: false,
    }

    if (cursor) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString())
    }

    const result = await docClient.send(new QueryCommand(params))

    return successResponse({
      items: (result.Items || []).map(item => ({
        date: item.GSI1SK,
        title: item.title,
        description: item.description,
        author: item.author,
        updatedAt: item.updatedAt,
      })),
      nextCursor: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    })
  } catch (error) {
    log.error('list_letters_error', { error: (error as Error).message })
    throw error
  }
}

async function getLetter(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
      description: result.Item.description,
      author: result.Item.author,
      tags: result.Item.tags,
      content: result.Item.content,
      pdfKey: result.Item.pdfKey,
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt,
      lastEditedBy: result.Item.lastEditedBy,
      versionCount: result.Item.versionCount || 0,
    })
  } catch (error) {
    log.error('get_letter_error', { date, error: (error as Error).message })
    throw error
  }
}

async function updateLetter(
  event: APIGatewayProxyEvent,
  requesterId: string
): Promise<APIGatewayProxyResult> {
  const date = event.pathParameters?.date

  let body: { content?: string; title?: string; author?: string; description?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }

  const { content, title, author, description } = body

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  if (!content) {
    return errorResponse(400, 'Content is required')
  }

  try {
    const current = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
    }))

    if (!current.Item) {
      return errorResponse(404, 'Letter not found')
    }

    const now = new Date().toISOString()
    const versionNumber = ((current.Item.versionCount as number) || 0) + 1

    // Create version of current content
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys.letterVersion(date, now),
        content: current.Item.content,
        title: current.Item.title,
        author: current.Item.author,
        description: current.Item.description,
        editedBy: current.Item.lastEditedBy,
        editedAt: current.Item.updatedAt,
        versionNumber: current.Item.versionCount || 0,
        entityType: 'LETTER_VERSION',
      },
    }))

    const updatedTitle = title || current.Item.title
    const updatedAuthor = author !== undefined ? author : current.Item.author
    const updatedDescription = description !== undefined ? description : current.Item.description

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
      UpdateExpression: 'SET content = :content, title = :title, author = :author, description = :description, updatedAt = :now, lastEditedBy = :editor, versionCount = :vc',
      ExpressionAttributeValues: {
        ':content': content,
        ':title': updatedTitle,
        ':author': updatedAuthor,
        ':description': updatedDescription,
        ':now': now,
        ':editor': requesterId,
        ':vc': versionNumber,
      },
    }))

    // Update S3 archive
    const letterJson = {
      date,
      title: updatedTitle,
      author: updatedAuthor || null,
      description: updatedDescription || null,
      content,
      pdfKey: current.Item.pdfKey || null,
      updatedAt: now,
    }

    await s3Client.send(new PutObjectCommand({
      Bucket: ARCHIVE_BUCKET,
      Key: `letters/${date}/${date}.json`,
      Body: JSON.stringify(letterJson, null, 2),
      ContentType: 'application/json',
    }))

    return successResponse({
      message: 'Letter updated',
      versionCount: versionNumber,
    })
  } catch (error) {
    log.error('update_letter_error', { date, error: (error as Error).message })
    throw error
  }
}

async function getVersions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const date = event.pathParameters?.date

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': keys.letter(date).PK,
        ':skPrefix': 'VERSION#',
      },
      ScanIndexForward: false,
    }))

    const versions = (result.Items || []).map(item => ({
      versionNumber: item.versionNumber,
      editedAt: item.editedAt,
      editedBy: item.editedBy,
      timestamp: item.SK?.replace('VERSION#', ''),
    }))

    return successResponse({ versions })
  } catch (error) {
    log.error('get_versions_error', { date, error: (error as Error).message })
    throw error
  }
}

async function revertToVersion(
  event: APIGatewayProxyEvent,
  requesterId: string
): Promise<APIGatewayProxyResult> {
  const date = event.pathParameters?.date

  let body: { timestamp?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'Invalid JSON body')
  }

  const { timestamp } = body

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  if (!timestamp) {
    return errorResponse(400, 'Version timestamp is required')
  }

  try {
    const versionResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letterVersion(date, timestamp),
    }))

    if (!versionResult.Item) {
      return errorResponse(404, 'Version not found')
    }

    const version = versionResult.Item
    const now = new Date().toISOString()

    // Get current to create new version
    const current = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
    }))

    if (current.Item) {
      const newVersionNumber = ((current.Item.versionCount as number) || 0) + 1

      // Save current as version before reverting
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...keys.letterVersion(date, now),
          content: current.Item.content,
          title: current.Item.title,
          author: current.Item.author,
          description: current.Item.description,
          editedBy: current.Item.lastEditedBy,
          editedAt: current.Item.updatedAt,
          versionNumber: current.Item.versionCount || 0,
          entityType: 'LETTER_VERSION',
        },
      }))

      // Update current with reverted content
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: keys.letter(date),
        UpdateExpression: 'SET content = :content, title = :title, author = :author, description = :description, updatedAt = :now, lastEditedBy = :editor, versionCount = :vc',
        ExpressionAttributeValues: {
          ':content': version.content,
          ':title': version.title,
          ':author': version.author,
          ':description': version.description,
          ':now': now,
          ':editor': requesterId,
          ':vc': newVersionNumber,
        },
      }))
    }

    return successResponse({ message: 'Reverted to version', timestamp })
  } catch (error) {
    log.error('revert_version_error', { date, timestamp, error: (error as Error).message })
    throw error
  }
}

async function getPdfUrl(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const date = event.pathParameters?.date

  if (!date || !isValidDate(date)) {
    return errorResponse(400, 'Valid date parameter required (YYYY-MM-DD)')
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.letter(date),
    }))

    if (!result.Item || !result.Item.pdfKey) {
      return errorResponse(404, 'PDF not found')
    }

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: ARCHIVE_BUCKET, Key: result.Item.pdfKey as string }),
      { expiresIn: 3600 }
    )

    return successResponse({ downloadUrl })
  } catch (error) {
    log.error('get_pdf_url_error', { date, error: (error as Error).message })
    throw error
  }
}
