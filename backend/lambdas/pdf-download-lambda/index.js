import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' })

const BUCKET_NAME = process.env.BUCKET_NAME
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

function createAPIGatewayResponse(statusCode, body, headers = {}, isBase64 = false) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: isBase64,
  }
}

function createErrorResponse(statusCode, error, message, code = null) {
  const errorBody = {
    error,
    message,
    timestamp: new Date().toISOString(),
  }

  if (code) {
    errorBody.code = code
  }

  return createAPIGatewayResponse(statusCode, errorBody, { 'Content-Type': 'application/json' })
}

async function getMarkdownContent(bucketName, key) {
  try {
    const cleanKey = key.replace(/^\//, '')
    const mdKey = `urara/${cleanKey}/+page.svelte.md`

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: mdKey,
    })

    const response = await s3Client.send(command)
    const content = await response.Body.transformToString()

    return content
  }
  catch (error) {
    console.error('Error getting markdown content:', error)
    throw new Error('Failed to get markdown content from S3')
  }
}

async function updateMarkdownContent(bucketName, key, content) {
  try {
    const cleanKey = key.replace(/^\//, '')
    const mdKey = `urara/${cleanKey}/+page.svelte.md`

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: mdKey,
      Body: content,
      ContentType: 'text/markdown',
    })

    await s3Client.send(command)

    return true
  }
  catch (error) {
    console.error('Error updating markdown content:', error)
    throw new Error('Failed to update markdown content in S3')
  }
}

async function getS3PdfKeys(bucketName, prefix) {
  try {
    const searchPrefix = prefix.replace('/*.pdf', '/')

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: searchPrefix,
    })

    const response = await s3Client.send(command)

    if (!response.Contents) {
      return []
    }

    const pdfKeys = response.Contents
      .filter(obj => obj.Key && obj.Key.toLowerCase().endsWith('.pdf'))
      .map(obj => obj.Key)

    return pdfKeys
  }
  catch (error) {
    console.error('Error listing objects:', error)
    throw new Error('Failed to list PDF files from S3')
  }
}

async function downloadPdfFromS3(bucketName, key) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })

    const response = await s3Client.send(command)

    const chunks = []
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    return buffer
  }
  catch (error) {
    console.error('Error downloading PDF:', error)
    throw new Error('Failed to download PDF')
  }
}

async function handleMarkdownRequest(requestData) {
  try {
    if (requestData.type === 'markdown') {
      const { key, content } = requestData
      if (!key || !content) {
        throw new Error('Missing required fields: key and content')
      }

      const cleanKey = key.replace(/^\//, '')
      const mdKey = `urara/${cleanKey}/+page.svelte.md`

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: mdKey,
        Body: content,
        ContentType: 'text/markdown',
      })

      await s3Client.send(command)

      return createAPIGatewayResponse(200, {
        success: true,
        message: 'Content updated successfully',
        key: mdKey,
        timestamp: new Date().toISOString(),
      })
    }
    else {
      const mdContent = await getMarkdownContent(BUCKET_NAME, requestData.key)
      return createAPIGatewayResponse(200, {
        content: mdContent,
        generatedAt: new Date().toISOString(),
      })
    }
  }
  catch (error) {
    console.error('Error handling markdown request:', error)
    return createErrorResponse(error.message.includes('Missing') ? 400 : 500, error.message.includes('Missing') ? 'Bad Request' : 'Internal Server Error', error.message)
  }
}

async function handlePdfRequest(requestedKey) {
  try {
    const cleanKey = requestedKey.replace(/^\//, '').replace(/\/$/, '')
    const prefix = `urara/${cleanKey}/*.pdf`

    const pdfKeys = await getS3PdfKeys(BUCKET_NAME, prefix)

    if (!pdfKeys || pdfKeys.length === 0) {
      return createErrorResponse(404, 'Not Found', 'No PDF document found')
    }

    const targetKey = pdfKeys[0]

    const pdfBuffer = await downloadPdfFromS3(BUCKET_NAME, targetKey)

    const pathParts = targetKey.split('/')
    const letterName = pathParts.length >= 3 ? pathParts.slice(1, -1).join(' ') : 'letter'
    const safeFileName = `${letterName}.pdf`

    return createAPIGatewayResponse(200, pdfBuffer.toString('base64'), {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
      'Content-Length': pdfBuffer.length.toString(),
      'Cache-Control': 'no-cache',
    }, true)
  }
  catch (error) {
    console.error('Error handling PDF request:', error)
    return createErrorResponse(500, 'Internal Server Error', 'Failed to process PDF download')
  }
}

function getRequestData(event) {
  if (event && typeof event.key === 'string') {
    return event
  }

  if (event.body) {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body
  }

  throw new Error('Invalid request format')
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return createAPIGatewayResponse(200, { message: 'CORS preflight successful' })
  }

  if (!BUCKET_NAME) {
    return createErrorResponse(500, 'Configuration Error', 'Server configuration error: Bucket name missing')
  }

  try {
    let requestData
    try {
      requestData = getRequestData(event)

      if (!requestData.key && !requestData.title) {
        return createErrorResponse(400, 'Bad Request', 'Missing required field: key or title')
      }
    }
    catch (error) {
      return createErrorResponse(400, 'Bad Request', 'Invalid request format')
    }

    if (requestData.type === 'markdown' || requestData.type === 'update') {
      return await handleMarkdownRequest(requestData)
    }
    else {
      const requestKey = requestData.key || requestData.title
      return await handlePdfRequest(requestKey)
    }
  }
  catch (error) {
    console.error('Error processing request:', error)
    return createErrorResponse(500, 'Internal Server Error', 'An unexpected error occurred while processing the request')
  }
}
