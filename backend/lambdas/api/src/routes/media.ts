/**
 * Media route handler
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import type { RequestContext } from '../types'
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ARCHIVE_BUCKET } from '../lib/database'
import { successResponse, errorResponse } from '../lib/responses'
import { log } from '../lib/logger'

const s3Client = new S3Client({})

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/avi', 'video/mov',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

/**
 * Main media route handler
 */
export async function handle(
  event: APIGatewayProxyEvent,
  context: RequestContext
): Promise<APIGatewayProxyResult> {
  const { requesterId, requesterEmail } = context

  if (!requesterId) {
    return errorResponse(401, 'Unauthorized: Missing user context')
  }

  const method = event.httpMethod
  const resource = event.resource
  const normalizedResource = resource.replace(/^\/v1/, '')

  if (method === 'POST' && normalizedResource === '/media/upload-url') {
    return getUploadUrl(event, requesterId, requesterEmail)
  }

  if (method === 'POST' && normalizedResource === '/media/list') {
    return listMedia(event)
  }

  if (method === 'GET' && normalizedResource === '/pdf/download-url') {
    return getPdfDownloadUrl(event)
  }

  if (method === 'GET' && normalizedResource === '/download/presigned-url') {
    return getDownloadUrl(event)
  }

  return errorResponse(404, 'Route not found')
}

async function getUploadUrl(
  event: APIGatewayProxyEvent,
  requesterId: string,
  requesterEmail?: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { filename, contentType, fileSize } = body

  if (!filename || !contentType) {
    return errorResponse(400, 'Filename and contentType are required')
  }

  const safeFilename = sanitizeFilename(filename)
  if (!safeFilename) {
    return errorResponse(400, 'Invalid filename')
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
    const key = `media/${category}/${Date.now()}-${safeFilename}`

    const command = new PutObjectCommand({
      Bucket: ARCHIVE_BUCKET,
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
    log.error('upload_url_error', { error: (error as Error).message })
    return errorResponse(500, 'Failed to generate upload URL')
  }
}

async function listMedia(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}')
  const { category } = body

  if (!category || !['pictures', 'videos', 'documents'].includes(category)) {
    return errorResponse(400, 'Valid category required: pictures, videos, or documents')
  }

  try {
    const prefix = `media/${category}/`
    const allContents: Array<{ Key?: string; LastModified?: Date; Size?: number }> = []
    let continuationToken: string | undefined

    do {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: ARCHIVE_BUCKET,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }))

      if (response.Contents) {
        allContents.push(...response.Contents)
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)

    if (allContents.length === 0) {
      return successResponse([])
    }

    const mediaItems = await Promise.all(
      allContents.map(async (item) => {
        if (!item.Key) return null

        const signedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: ARCHIVE_BUCKET, Key: item.Key }),
          { expiresIn: 3600 }
        )

        const filename = item.Key.split('/').pop() || ''
        const title = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ')

        return {
          id: item.Key,
          filename,
          title,
          uploadDate: item.LastModified?.toISOString(),
          fileSize: item.Size,
          contentType: getContentTypeFromKey(item.Key),
          signedUrl,
          category,
        }
      })
    )

    return successResponse(mediaItems.filter(Boolean))
  } catch (error) {
    log.error('list_media_error', { error: (error as Error).message })
    return errorResponse(500, 'Failed to retrieve media items')
  }
}

async function getPdfDownloadUrl(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const title = event.queryStringParameters?.title

  if (!title) {
    return errorResponse(400, 'Missing title parameter')
  }

  const sanitizedTitle = title.replace(/[/\\]+/g, '_').replace(/\.\./g, '_').trim()
  if (!sanitizedTitle) {
    return errorResponse(400, 'Invalid title')
  }

  try {
    const prefix = `letters/${sanitizedTitle}/`

    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: ARCHIVE_BUCKET,
      Prefix: prefix,
    }))

    const pdfKeys = (response.Contents || [])
      .filter(obj => obj.Key?.toLowerCase().endsWith('.pdf'))
      .map(obj => obj.Key)
      .filter((key): key is string => !!key)

    if (pdfKeys.length === 0) {
      return errorResponse(404, 'No PDF document found')
    }

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: ARCHIVE_BUCKET, Key: pdfKeys[0] }),
      { expiresIn: 3600 }
    )

    return successResponse({
      downloadUrl,
      filename: pdfKeys[0].split('/').pop(),
    })
  } catch (error) {
    log.error('pdf_download_url_error', { error: (error as Error).message })
    return errorResponse(500, 'Failed to generate download URL')
  }
}

async function getDownloadUrl(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const key = event.queryStringParameters?.key

  if (!key) {
    return errorResponse(400, 'Missing key parameter')
  }

  if (key.includes('..')) {
    return errorResponse(400, 'Invalid key')
  }

  const allowedPrefixes = ['media/', 'letters/', 'temp/']
  if (!allowedPrefixes.some(prefix => key.startsWith(prefix))) {
    return errorResponse(403, 'Access denied to this resource')
  }

  try {
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: ARCHIVE_BUCKET, Key: key }),
      { expiresIn: 3600 }
    )

    return successResponse({
      downloadUrl,
      filename: key.split('/').pop(),
    })
  } catch (error) {
    log.error('download_url_error', { error: (error as Error).message })
    return errorResponse(500, 'Failed to generate download URL')
  }
}

function determineCategory(contentType: string): string {
  if (contentType.startsWith('image/')) return 'pictures'
  if (contentType.startsWith('video/')) return 'videos'
  return 'documents'
}

function getContentTypeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', avi: 'video/avi', mov: 'video/mov',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  }
  return map[ext || ''] || 'application/octet-stream'
}

function sanitizeFilename(filename: string | undefined): string | null {
  if (!filename) return null

  let safe = filename.split(/[/\\]/).pop() || ''
  safe = safe.replace(/\.\./g, '')
  safe = safe.replace(/^\.+/, '')
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_')

  if (safe.length > 200) {
    const ext = safe.split('.').pop() || ''
    const base = safe.slice(0, 190 - ext.length)
    safe = ext ? `${base}.${ext}` : base
  }

  return safe || null
}
