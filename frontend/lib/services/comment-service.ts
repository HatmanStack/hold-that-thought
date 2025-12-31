import type {
  CommentApiResponse,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '$lib/types/comment'
import { authTokens } from '$lib/auth/auth-store'
import { getApiBaseUrl } from '$lib/utils/api-url'
import { get } from 'svelte/store'

const API_BASE = getApiBaseUrl()

function encodeItemId(itemId: string): string {
  // Decode first in case it's already URL-encoded, then base64
  let decoded: string
  try {
    decoded = decodeURIComponent(itemId)
  }
  catch {
    decoded = itemId // Use as-is if not URL-encoded
  }
  return btoa(decoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function getAuthHeader(): Record<string, string> {
  const tokens = get(authTokens)
  if (!tokens?.idToken) {
    throw new Error('Your session has expired. Please log in again.')
  }
  return {
    'Authorization': `Bearer ${tokens.idToken}`,
    'Content-Type': 'application/json',
  }
}

export async function getComments(
  itemId: string,
  limit: number = 50,
  lastKey?: string,
): Promise<CommentApiResponse> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (lastKey) {
      params.set('lastEvaluatedKey', lastKey)
    }

    const response = await fetch(`${API_BASE}/comments/${encodeItemId(itemId)}?${params}`, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch comments' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data: data.items || data,
      lastEvaluatedKey: data.lastEvaluatedKey,
    }
  }
  catch (error) {
    console.error('Error fetching comments:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch comments',
    }
  }
}

export async function createComment(
  itemId: string,
  text: string,
  itemType: 'letter' | 'media',
  itemTitle: string,
): Promise<CommentApiResponse> {
  try {
    const body: CreateCommentRequest = {
      commentText: text,
      itemType,
      itemTitle,
    }

    const response = await fetch(`${API_BASE}/comments/${encodeItemId(itemId)}`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create comment' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  }
  catch (error) {
    console.error('Error creating comment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create comment',
    }
  }
}

export async function updateComment(
  itemId: string,
  commentId: string,
  text: string,
): Promise<CommentApiResponse> {
  try {
    const body: UpdateCommentRequest = {
      commentText: text,
    }

    const url = `${API_BASE}/comments/${encodeItemId(itemId)}/${encodeURIComponent(commentId)}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update comment' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  }
  catch (error) {
    console.error('Error updating comment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update comment',
    }
  }
}

export async function deleteComment(
  itemId: string,
  commentId: string,
): Promise<CommentApiResponse> {
  try {
    const response = await fetch(
      `${API_BASE}/comments/${encodeItemId(itemId)}/${encodeURIComponent(commentId)}`,
      {
        method: 'DELETE',
        headers: getAuthHeader(),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete comment' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  }
  catch (error) {
    console.error('Error deleting comment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete comment',
    }
  }
}

export async function adminDeleteComment(commentId: string): Promise<CommentApiResponse> {
  try {
    // Ensure commentId is URL-encoded
    const encodedCommentId = encodeURIComponent(commentId)
    const response = await fetch(`${API_BASE}/admin/comments/${encodedCommentId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete comment' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  }
  catch (error) {
    console.error('Error deleting comment (admin):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete comment',
    }
  }
}
