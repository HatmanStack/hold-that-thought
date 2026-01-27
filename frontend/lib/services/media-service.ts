import { PUBLIC_RAGSTACK_API_KEY, PUBLIC_RAGSTACK_GRAPHQL_URL } from '$env/static/public'
import { authStore } from '$lib/auth/auth-store'
import { getApiBaseUrl } from '$lib/utils/api-url'
import { get } from 'svelte/store'

export interface MediaItem {
  id: string
  filename: string
  title: string
  description?: string
  uploadDate: string
  fileSize: number
  contentType: string
  thumbnailUrl?: string
  signedUrl?: string
  category: 'pictures' | 'videos' | 'documents'
}

interface RagImage {
  imageId: string
  filename: string
  s3Uri: string
  thumbnailUrl?: string
  caption?: string
  contentType?: string
  fileSize?: number
  createdAt: string
}

interface RagDocument {
  documentId: string
  filename: string
  type: string
  mediaType?: string
  inputS3Uri: string
  previewUrl?: string
  status: string
  createdAt: string
}

const API_URL = getApiBaseUrl()

async function ragstackQuery(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  if (!PUBLIC_RAGSTACK_GRAPHQL_URL || !PUBLIC_RAGSTACK_API_KEY) {
    throw new Error('RAGStack not configured')
  }

  const response = await fetch(PUBLIC_RAGSTACK_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PUBLIC_RAGSTACK_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`RAGStack request failed: ${response.status}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL error')
  }
  return json.data
}

/**
 * Extract S3 key from an s3:// URI
 * e.g. "s3://bucket-name/content/abc/file.mp4" -> "content/abc/file.mp4"
 */
function s3UriToKey(s3Uri: string): string {
  const match = s3Uri.match(/^s3:\/\/[^/]+\/(.+)$/)
  return match ? match[1] : s3Uri
}

/**
 * Get a presigned download URL for a RAGStack S3 key via the backend proxy
 */
async function getPresignedUrl(s3Key: string): Promise<string> {
  const auth = get(authStore)
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated')
  }

  const response = await fetch(
    `${API_URL}/download/presigned-url?key=${encodeURIComponent(s3Key)}&bucket=ragstack`,
    {
      headers: { Authorization: `Bearer ${auth.tokens.idToken}` },
    },
  )

  if (!response.ok) {
    throw new Error('Failed to get download URL')
  }

  const data = await response.json()
  return data.downloadUrl
}

/**
 * Determine content type from filename extension
 */
function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
  }
  return map[ext] || 'application/octet-stream'
}

function imageToMediaItem(img: RagImage): MediaItem {
  return {
    id: img.imageId,
    filename: img.filename,
    title: img.filename,
    description: img.caption || undefined,
    uploadDate: img.createdAt,
    fileSize: img.fileSize || 0,
    contentType: img.contentType || inferContentType(img.filename),
    thumbnailUrl: img.thumbnailUrl || undefined,
    signedUrl: img.thumbnailUrl || undefined, // RAGStack provides presigned thumbnailUrl for images
    category: 'pictures',
  }
}

function documentToMediaItem(doc: RagDocument, category: 'videos' | 'documents'): MediaItem {
  return {
    id: doc.documentId,
    filename: doc.filename,
    title: doc.filename,
    uploadDate: doc.createdAt,
    fileSize: 0, // not available from listDocuments
    contentType: inferContentType(doc.filename),
    signedUrl: '', // populated lazily via getPresignedUrl when needed
    category,
  }
}

// Cache of documents fetched from RAGStack (no pagination, returns all at once)
let cachedDocuments: RagDocument[] | null = null

async function fetchDocuments(): Promise<RagDocument[]> {
  if (cachedDocuments)
    return cachedDocuments

  const data = await ragstackQuery(`query {
    listDocuments {
      items { documentId filename type mediaType inputS3Uri previewUrl status createdAt }
    }
  }`) as { listDocuments: { items: RagDocument[] } }

  cachedDocuments = (data.listDocuments.items || []).filter(d => d.status === 'INDEXED')
  return cachedDocuments
}

export async function getMediaItems(category: 'pictures' | 'videos' | 'documents'): Promise<MediaItem[]> {
  if (category === 'pictures') {
    const data = await ragstackQuery(`query {
      listImages(limit: 100) {
        items { imageId filename s3Uri thumbnailUrl caption contentType fileSize createdAt }
      }
    }`) as { listImages: { items: RagImage[] } }

    return (data.listImages.items || []).map(imageToMediaItem)
  }

  // Videos and documents both come from listDocuments
  const docs = await fetchDocuments()

  if (category === 'videos') {
    // type=media + mediaType=video, or video file extensions
    const videos = docs.filter(d =>
      (d.type === 'media' && d.mediaType === 'video')
      || /\.(?:mp4|webm|mov|avi|mkv)$/i.test(d.filename),
    )
    return videos.map(d => documentToMediaItem(d, 'videos'))
  }

  // Documents: exclude letters (.md files with date prefix), videos, and images
  const documents = docs.filter(d =>
    d.type === 'document'
    && !d.mediaType
    && !/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(d.filename)
    && !/\.(?:mp4|webm|mov|avi|mkv)$/i.test(d.filename),
  )
  return documents.map(d => documentToMediaItem(d, 'documents'))
}

/**
 * Resolve the signedUrl for a media item that needs a backend-proxied presigned URL.
 * Images already have signedUrl from thumbnailUrl. Videos/documents need this.
 */
export async function resolveSignedUrl(item: MediaItem): Promise<string> {
  if (item.signedUrl)
    return item.signedUrl

  // Look up the inputS3Uri from the cached documents
  const docs = cachedDocuments || await fetchDocuments()
  const doc = docs.find(d => d.documentId === item.id)
  if (!doc)
    throw new Error(`Document ${item.id} not found`)

  const key = s3UriToKey(doc.inputS3Uri)
  return getPresignedUrl(key)
}

/**
 * Invalidate the document cache (call after uploads)
 */
export function invalidateMediaCache() {
  cachedDocuments = null
}
