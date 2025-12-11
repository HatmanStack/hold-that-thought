const { S3Client, PutObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')
const { GetCommand, DeleteCommand, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { 
  docClient, 
  TABLE_NAME, 
  ARCHIVE_BUCKET, 
  S3_PREFIXES, 
  keys, 
  successResponse, 
  errorResponse 
} = require('../utils')

const s3Client = new S3Client({})
const lambdaClient = new LambdaClient({})

exports.handle = async (event, context) => {
  const { httpMethod, path, body } = event
  const { requesterId, isAdmin, isApprovedUser } = context

  if (path.endsWith('/upload-request') && httpMethod === 'POST') {
    return handleUploadRequest(JSON.parse(body), requesterId)
  }

  if (path.includes('/letters/process/') && httpMethod === 'POST') {
    const uploadId = path.split('/').pop()
    return handleProcess(uploadId, requesterId)
  }

  // Draft management routes - require ApprovedUsers or Admins
  if (path.includes('/admin/drafts')) {
    if (!isApprovedUser && !isAdmin) return errorResponse(403, 'Unauthorized')

    if (path.endsWith('/publish') && httpMethod === 'POST') {
       // /admin/drafts/{draftId}/publish
       const parts = path.split('/')
       const draftId = parts[parts.length - 2]
       return handlePublish(draftId, JSON.parse(body), requesterId)
    }

    if (path.endsWith('/drafts') && httpMethod === 'GET') {
      return handleListDrafts()
    }

    if (httpMethod === 'GET') {
      const draftId = path.split('/').pop()
      return handleGetDraft(draftId)
    }

    if (httpMethod === 'DELETE') {
      const draftId = path.split('/').pop()
      return handleDeleteDraft(draftId)
    }
  }

  return errorResponse(404, 'Draft route not found')
}

async function handleUploadRequest(data, requesterId) {
  const { fileCount = 1, fileTypes = [] } = data
  const uploadId = uuidv4()
  const urls = []

  for (let i = 0; i < fileCount; i++) {
    const type = fileTypes[i] || 'application/pdf'
    // Simple extension mapping
    let ext = 'pdf'
    if (type === 'image/jpeg') ext = 'jpg'
    if (type === 'image/png') ext = 'png'
    
    const key = `${S3_PREFIXES.temp}${uploadId}/${i}.${ext}`
    
    const command = new PutObjectCommand({
      Bucket: ARCHIVE_BUCKET,
      Key: key,
      ContentType: type
    })
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    urls.push({ url, key, index: i })
  }

  return successResponse({ uploadId, urls })
}

async function handleProcess(uploadId, requesterId) {
  const functionName = process.env.LETTER_PROCESSOR_FUNCTION_NAME
  
  if (!functionName) {
    console.error('LETTER_PROCESSOR_FUNCTION_NAME not set')
    return errorResponse(500, 'Configuration error')
  }

  try {
    const payload = JSON.stringify({ uploadId, requesterId })
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // Async
      Payload: payload
    })
    
    await lambdaClient.send(command)
    return successResponse({ message: 'Processing started' }, 202)
  } catch (err) {
    console.error('Failed to invoke processor:', err)
    return errorResponse(500, 'Failed to start processing')
  }
}

async function handleListDrafts() {
  try {
    // Scan isn't ideal but acceptable for low volume drafts
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'DRAFT#'
      }
    })
    
    const result = await docClient.send(command)
    return successResponse({ drafts: result.Items })
  } catch (err) {
    console.error('Failed to list drafts:', err)
    return errorResponse(500, 'Failed to list drafts')
  }
}

async function handleGetDraft(draftId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.draft(draftId)
    }))
    
    if (!result.Item) return errorResponse(404, 'Draft not found')
    return successResponse(result.Item)
  } catch (err) {
    console.error('Failed to get draft:', err)
    return errorResponse(500, 'Failed to get draft')
  }
}

async function handleDeleteDraft(draftId) {
    try {
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: keys.draft(draftId)
        }))
        return successResponse({ message: 'Draft deleted' })
    } catch (err) {
        console.error('Failed to delete draft:', err)
        return errorResponse(500, 'Failed to delete draft')
    }
}

async function handlePublish(draftId, data, requesterId) {
    const { finalData } = data
    if (!finalData || !finalData.date || !finalData.title || !finalData.content) {
        return errorResponse(400, 'Missing required fields: date, title, content')
    }

    try {
        // 1. Get Draft to find s3Key
        const draftRes = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: keys.draft(draftId)
        }))
        const draft = draftRes.Item
        if (!draft) return errorResponse(404, 'Draft not found')

        // 2. Determine paths
        const slug = finalData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const letterPrefix = `${S3_PREFIXES.letters}${slug}/`
        const pdfKey = `${letterPrefix}${finalData.date}.pdf`
        const jsonKey = `${letterPrefix}letter.json`

        // 3. Move PDF
        await s3Client.send(new CopyObjectCommand({
            Bucket: ARCHIVE_BUCKET,
            CopySource: `${ARCHIVE_BUCKET}/${draft.s3Key}`,
            Key: pdfKey
        }))

        // 4. Write Metadata JSON to S3
        await s3Client.send(new PutObjectCommand({
            Bucket: ARCHIVE_BUCKET,
            Key: jsonKey,
            Body: JSON.stringify(finalData, null, 2),
            ContentType: 'application/json'
        }))

        // 5. Write DB Letter
        // Use existing key builder if compatible or match Phase 0
        // keys.letter(date) => PK: LETTER#date, SK: CURRENT
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                ...keys.letter(finalData.date),
                entityType: 'LETTER',
                ...finalData,
                s3PdfKey: pdfKey,
                s3JsonKey: jsonKey,
                createdAt: new Date().toISOString(),
                publishedBy: requesterId
            }
        }))

        // 6. Delete Draft
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: keys.draft(draftId)
        }))

        return successResponse({ message: 'Letter published', path: `/letters/${finalData.date}` })

    } catch (err) {
        console.error('Publish failed:', err)
        return errorResponse(500, 'Failed to publish letter')
    }
}
