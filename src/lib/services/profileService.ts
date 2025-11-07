import { authTokens } from '$lib/auth/auth-store'
import { get } from 'svelte/store'
import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'
import type {
  UserProfile,
  ProfileApiResponse,
  UpdateProfileRequest,
  CommentHistoryItem,
  CommentHistoryResponse
} from '$lib/types/profile'

const API_BASE = PUBLIC_API_GATEWAY_URL

/**
 * Get authorization header with JWT token
 * @throws Error if user is not authenticated or token is missing
 */
function getAuthHeader(): Record<string, string> {
  const tokens = get(authTokens)
  if (!tokens?.idToken) {
    throw new Error('Your session has expired. Please log in again.')
  }
  return {
    Authorization: `Bearer ${tokens.idToken}`,
    'Content-Type': 'application/json'
  }
}

/**
 * Get a user's profile by userId
 */
export async function getProfile(userId: string): Promise<ProfileApiResponse> {
  try {
    const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(userId)}`, {
      headers: getAuthHeader()
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch profile' }))

      // Handle specific error cases
      if (response.status === 403) {
        return {
          success: false,
          error: 'This profile is private'
        }
      }

      if (response.status === 404) {
        return {
          success: false,
          error: 'Profile not found'
        }
      }

      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch profile'
    }
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(updates: UpdateProfileRequest): Promise<ProfileApiResponse> {
  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update profile'
    }
  }
}

/**
 * Get a user's comment history
 */
export async function getCommentHistory(
  userId: string,
  limit: number = 50,
  lastKey?: string
): Promise<CommentHistoryResponse> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (lastKey) {
      params.set('lastEvaluatedKey', lastKey)
    }

    const response = await fetch(
      `${API_BASE}/profile/${encodeURIComponent(userId)}/comments?${params}`,
      {
        headers: getAuthHeader()
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch comment history' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      data: data.items || data,
      lastEvaluatedKey: data.lastEvaluatedKey
    }
  } catch (error) {
    console.error('Error fetching comment history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch comment history'
    }
  }
}

/**
 * Upload a profile photo and get the S3 URL
 * This function gets a presigned URL from the backend and uploads the file to S3
 */
export async function uploadProfilePhoto(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/gif']
    const maxSize = 5 * 1024 * 1024 // 5MB

    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please use JPG, PNG, or GIF.'
      }
    }

    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File too large. Maximum size is 5MB.'
      }
    }

    // Get presigned URL from backend
    const response = await fetch(`${API_BASE}/profile/photo/upload-url`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to get upload URL' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      }
    }

    const { uploadUrl, photoUrl } = await response.json()

    // Upload file to S3 using presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    })

    if (!uploadResponse.ok) {
      return {
        success: false,
        error: 'Failed to upload photo to S3'
      }
    }

    return {
      success: true,
      url: photoUrl
    }
  } catch (error) {
    console.error('Error uploading profile photo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload photo'
    }
  }
}
