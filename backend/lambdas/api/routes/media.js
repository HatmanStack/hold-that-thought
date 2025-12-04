const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { BUCKETS, successResponse, errorResponse } = require('../utils')

const s3Client = new S3Client({})

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/avi', 'video/mov',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]

async function handle(event, context) {
  const { requesterId, requesterEmail } = context

  if (!requesterId) {
    return errorResponse(401, 'Unauthorized: Missing user context')
  }

  const method = event.httpMethod
  const resource = event.resource

  // Media upload URL
  if (method === 'POST' && resource === '/media/upload-url') {
    return await getUploadUrl(event, requesterId, requesterEmail)
  }

  // List media
  if (method === 'POST' && resource === '/media/list') {
    return await listMedia(event, requesterId)
  }

  // PDF download
  if (method === 'GET' && resource === '/pdf/download-url') {
    return await getPdfDownloadUrl(event, requesterId)
  }

  // Generic download presigned URL
  if (method === 'GET' && resource === '/download/presigned-url') {
    return await getDownloadUrl(event, requesterId)
  }

  return errorResponse(404, 'Route not found')
}

async function getUploadUrl(event, requesterId, requesterEmail) {
  const body = JSON.parse(event.body || '{}')
  const { filename, contentType, fileSize } = body

  if (!filename || !contentType) {
    return errorResponse(400, 'Filename and contentType are required')
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    return errorResponse(400, 'File type not allowed')
  }

  const maxSize = 500 * 1024 * 1024 // 500MB
  if (fileSize && fileSize > maxSize) {
    return errorResponse(400, 'File size exceeds 500MB limit')
  }

  try {
    const category = determineCategory(contentType)
    const key = `media/${category}/${Date.now()}-${filename}`

    const command = new PutObjectCommand({
      Bucket: BUCKETS.media,
      Key: key,
      ContentType: contentType,
      Metadata: {
        'uploaded-by': requesterEmail || requesterId,
        'upload-timestamp': new Date().toISOString(),
      },
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

    return successResponse({
      presignedUrl,
      key,
      message: 'Presigned URL generated successfully',
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return errorResponse(500, 'Failed to generate upload URL')
  }
}

async function listMedia(event, requesterId) {
  const body = JSON.parse(event.body || '{}')
  const { category } = body

  if (!category || !['pictures', 'videos', 'documents'].includes(category)) {
    return errorResponse(400, 'Valid category required: pictures, videos, or documents')
  }

  try {
    const prefix = `media/${category}/`

    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKETS.media,
      Prefix: prefix,
      MaxKeys: 100,
    }))

    if (!response.Contents) {
      return successResponse([])
    }

    const mediaItems = await Promise.all(
      response.Contents.map(async (item) => {
        const signedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: BUCKETS.media, Key: item.Key }),
          { expiresIn: 3600 }
        )

        return {
          id: item.Key,
          filename: item.Key.split('/').pop(),
          uploadDate: item.LastModified.toISOString(),
          fileSize: item.Size,
          contentType: getContentTypeFromKey(item.Key),
          signedUrl,
          category,
        }
      })
    )

    return successResponse(mediaItems)
  } catch (error) {
    console.error('Error listing media:', error)
    return errorResponse(500, 'Failed to retrieve media items')
  }
}

async function getPdfDownloadUrl(event, requesterId) {
  const title = event.queryStringParameters?.title

  if (!title) {
    return errorResponse(400, 'Missing title parameter')
  }

  const sanitizedTitle = title.replace(/[/\\]+/g, '_').replace(/\.\./g, '_').trim()
  if (!sanitizedTitle) {
    return errorResponse(400, 'Invalid title')
  }

  try {
    const prefix = `urara/${sanitizedTitle}/`

    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKETS.media,
      Prefix: prefix,
    }))

    const pdfKeys = (response.Contents || [])
      .filter(obj => obj.Key?.toLowerCase().endsWith('.pdf'))
      .map(obj => obj.Key)

    if (pdfKeys.length === 0) {
      return errorResponse(404, 'No PDF document found')
    }

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: BUCKETS.media, Key: pdfKeys[0] }),
      { expiresIn: 3600 }
    )

    return successResponse({
      downloadUrl,
      filename: pdfKeys[0].split('/').pop(),
    })
  } catch (error) {
    console.error('Error getting PDF download URL:', error)
    return errorResponse(500, 'Failed to generate download URL')
  }
}

async function getDownloadUrl(event, requesterId) {
  const key = event.queryStringParameters?.key

  if (!key) {
    return errorResponse(400, 'Missing key parameter')
  }

  // Prevent path traversal
  if (key.includes('..')) {
    return errorResponse(400, 'Invalid key')
  }

  try {
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: BUCKETS.media, Key: key }),
      { expiresIn: 3600 }
    )

    return successResponse({
      downloadUrl,
      filename: key.split('/').pop(),
    })
  } catch (error) {
    console.error('Error getting download URL:', error)
    return errorResponse(500, 'Failed to generate download URL')
  }
}

function determineCategory(contentType) {
  if (contentType.startsWith('image/')) return 'pictures'
  if (contentType.startsWith('video/')) return 'videos'
  return 'documents'
}

function getContentTypeFromKey(key) {
  const ext = key.split('.').pop()?.toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', avi: 'video/avi', mov: 'video/mov',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  }
  return map[ext] || 'application/octet-stream'
}

module.exports = { handle }
