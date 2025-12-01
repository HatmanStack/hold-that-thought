import type {
  ConversationApiResponse,
  CreateConversationRequest,
  MessageApiResponse,
  SendMessageRequest,
  UploadAttachmentResponse,
} from '$lib/types/message'
import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'
import { authTokens } from '$lib/auth/auth-store'
import { get } from 'svelte/store'

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
    'Authorization': `Bearer ${tokens.idToken}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Get all conversations for the current user
 */
export async function getConversations(
  limit: number = 50,
  lastKey?: string,
): Promise<ConversationApiResponse> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (lastKey) {
      params.set('lastEvaluatedKey', lastKey)
    }

    const response = await fetch(`${API_BASE}/messages/conversations?${params}`, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch conversations' }))
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
    console.error('Error fetching conversations:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch conversations',
    }
  }
}

/**
 * Get messages for a specific conversation
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  lastKey?: string,
): Promise<MessageApiResponse> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (lastKey) {
      params.set('lastEvaluatedKey', lastKey)
    }

    const response = await fetch(
      `${API_BASE}/messages/conversations/${encodeURIComponent(conversationId)}?${params}`,
      {
        headers: getAuthHeader(),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch messages' }))
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
    console.error('Error fetching messages:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch messages',
    }
  }
}

/**
 * Create a new conversation with initial message
 */
export async function createConversation(
  participantIds: string[],
  messageText: string,
  conversationTitle?: string,
): Promise<ConversationApiResponse> {
  try {
    const body: CreateConversationRequest = {
      participantIds,
      messageText,
      conversationTitle,
    }

    const response = await fetch(`${API_BASE}/messages/conversations`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create conversation' }))
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
    console.error('Error creating conversation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create conversation',
    }
  }
}

/**
 * Send a message in an existing conversation
 */
export async function sendMessage(
  conversationId: string,
  messageText: string,
  attachments?: Array<{ s3Key: string, filename: string, contentType: string, size: number }>,
): Promise<MessageApiResponse> {
  try {
    const body: SendMessageRequest = {
      messageText,
      attachments,
    }

    const response = await fetch(
      `${API_BASE}/messages/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }))
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
    console.error('Error sending message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    }
  }
}

/**
 * Mark a conversation as read (reset unread count)
 */
export async function markAsRead(conversationId: string): Promise<ConversationApiResponse> {
  try {
    const response = await fetch(
      `${API_BASE}/messages/conversations/${encodeURIComponent(conversationId)}/read`,
      {
        method: 'PUT',
        headers: getAuthHeader(),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to mark as read' }))
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
    console.error('Error marking conversation as read:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark as read',
    }
  }
}

/**
 * Upload an attachment and get presigned URL
 */
export async function uploadAttachment(file: File): Promise<UploadAttachmentResponse> {
  try {
    // Step 1: Get presigned URL from backend
    const response = await fetch(`${API_BASE}/messages/attachments/upload-url`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to get upload URL' }))
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const { uploadUrl, s3Key } = await response.json()

    // Step 2: Upload file to S3 using presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      return {
        success: false,
        error: 'Failed to upload file to S3',
      }
    }

    return {
      success: true,
      data: {
        uploadUrl,
        s3Key,
      },
    }
  }
  catch (error) {
    console.error('Error uploading attachment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload attachment',
    }
  }
}
