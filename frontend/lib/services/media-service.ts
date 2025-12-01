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

export async function uploadMedia(file: File): Promise<MediaItem> {
  const auth = get(authStore)
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated')
  }

  // Use presigned URL for files larger than 5MB to avoid API Gateway limits
  const fileSize = file.size
  const usePresignedUrl = fileSize > 5 * 1024 * 1024 // 5MB threshold

  let result

  if (usePresignedUrl) {
    // Get presigned URL
    const presignedResponse = await fetch(`${PUBLIC_API_GATEWAY_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.tokens.idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'presigned-url',
        filename: file.name,
        contentType: file.type,
        fileSize,
      }),
    })

    if (!presignedResponse.ok) {
      const error = await presignedResponse.json()
      throw new Error(error.message || 'Failed to get presigned URL')
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

    // Create result object for presigned upload
    result = {
      key,
      filename: file.name,
      size: fileSize,
      contentType: file.type,
      success: true,
    }
  }
  else {
    // Use direct upload for smaller files
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.tokens.idToken}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Upload failed')
    }

    result = await response.json()
  }

  // Convert the Lambda response to a MediaItem
  return {
    id: result.key,
    filename: result.filename,
    title: result.filename,
    uploadDate: new Date().toISOString(),
    fileSize: result.size,
    contentType: result.contentType,
    signedUrl: result.url,
    category: determineCategory(result.contentType),
  }
}

export async function getMediaItems(category: 'pictures' | 'videos' | 'documents'): Promise<MediaItem[]> {
  const auth = get(authStore)
  if (!auth.isAuthenticated || !auth.tokens) {
    throw new Error('User is not authenticated')
  }

  const response = await fetch(`${PUBLIC_API_GATEWAY_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.tokens.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'list',
      category,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || `Failed to load ${category}`)
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
