import { getApiBaseUrl } from '$lib/utils/api-url'
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

const API_URL = getApiBaseUrl()

export async function uploadMedia(file: File): Promise<MediaItem> {
  const auth = get(authStore)
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated')
  }

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

    if (!presignedResponse.ok) {
      const error = await presignedResponse.json()
      throw new Error(error.error || error.message || 'Failed to get presigned URL')
    }

    const { presignedUrl, key } = await presignedResponse.json()

    // Upload directly to S3 using presigned URL
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

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

  const response = await fetch(`${API_URL}/media/list`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.tokens.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || `Failed to load ${category}`)
  }

  return response.json()
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
