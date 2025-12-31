import type { ReactionApiResponse } from '$lib/types/comment'
import { getApiBaseUrl } from '$lib/utils/api-url'
import { authTokens } from '$lib/auth/auth-store'
import { get } from 'svelte/store'

const API_BASE = getApiBaseUrl()

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

export async function getReactions(commentId: string): Promise<ReactionApiResponse> {
  try {
    const response = await fetch(`${API_BASE}/reactions/${encodeURIComponent(commentId)}`, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch reactions' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data: data.items || data,
    }
  }
  catch (error) {
    console.error('Error fetching reactions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch reactions',
    }
  }
}

export async function toggleReaction(commentId: string, itemId: string): Promise<ReactionApiResponse> {
  try {
    const response = await fetch(`${API_BASE}/reactions/${encodeURIComponent(commentId)}`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ itemId, reactionType: 'like' }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to toggle reaction' }))
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
    console.error('Error toggling reaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle reaction',
    }
  }
}
