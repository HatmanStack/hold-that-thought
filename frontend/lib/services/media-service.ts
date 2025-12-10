import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'
import { authStore } from '$lib/auth/auth-store'
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
  signedUrl: string
  category: 'pictures' | 'videos' | 'documents'
}

const API_URL = PUBLIC_API_GATEWAY_URL.replace(/\/+$/, '')

export async function uploadMedia(file: File): Promise<MediaItem> {
  const auth = get(authStore)
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated')
  }

  console.log('[media-service] uploadMedia called for:', file.name, file.type, file.size)

  try {
    // Get presigned URL from backend
    const presignedResponse = await fetch(`${API_URL}/media/upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.tokens.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
      }),
    })

    console.log('[media-service] Presigned URL response status:', presignedResponse.status)

    if (!presignedResponse.ok) {
      const error = await presignedResponse.json()
      throw new Error(error.error || error.message || 'Failed to get presigned URL')
    }

    const { presignedUrl, key } = await presignedResponse.json()
    console.log('[media-service] Got presigned URL for key:', key)

    // Upload directly to S3 using presigned URL
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

    console.log('[media-service] S3 upload response status:', uploadResponse.status)

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to S3')
    }

    // Convert the result to a MediaItem
    return {
      id: key,
      filename: file.name,
      title: file.name,
      uploadDate: new Date().toISOString(),
      fileSize: file.size,
      contentType: file.type,
      signedUrl: presignedUrl, // This won't work for viewing, but will be refreshed on list reload
      category: determineCategory(file.type),
    }
  }
  catch (error) {
    console.error('[media-service] Upload error:', error)
    throw error
  }
}

export async function getMediaItems(category: 'pictures' | 'videos' | 'documents'): Promise<MediaItem[]> {
  const auth = get(authStore)
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated')
  }

  console.log('[media-service] getMediaItems called for category:', category)

  const response = await fetch(`${API_URL}/media/list`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.tokens.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category }),
  })

  console.log('[media-service] List response status:', response.status)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || `Failed to load ${category}`)
  }

  const items = await response.json()
  console.log('[media-service] Got', items.length, 'items for', category)
  return items
}

function determineCategory(contentType: string): 'pictures' | 'videos' | 'documents' {
  if (contentType.startsWith('image/')) {
    return 'pictures'
  }
  else if (contentType.startsWith('video/')) {
    return 'videos'
  }
  return 'documents'
}
