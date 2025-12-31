import type {
  ConversationApiResponse,
  CreateConversationRequest,
  MessageApiResponse,
  SendMessageRequest,
  UploadAttachmentResponse,
} from '$lib/types/message'
import { authTokens } from '$lib/auth/auth-store'
import { getApiBaseUrl } from '$lib/utils/api-url'
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
      data: data.conversations || data.items || data,
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
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}?${params}`,
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
      data: data.messages || data.items || data,
      lastEvaluatedKey: data.lastEvaluatedKey,
      creatorId: data.creatorId,
      conversationTitle: data.conversationTitle,
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
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}`,
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

export async function markAsRead(conversationId: string): Promise<ConversationApiResponse> {
  try {
    const response = await fetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}/read`,
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

export async function deleteMessage(
  conversationId: string,
  messageId: string,
): Promise<MessageApiResponse> {
  const url = `${API_BASE}/messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(messageId)}`

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete message' }))
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
    console.error('Error deleting message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete message',
    }
  }
}

export async function deleteConversation(
  conversationId: string,
): Promise<ConversationApiResponse> {
  try {
    const response = await fetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        headers: getAuthHeader(),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete conversation' }))
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
    console.error('Error deleting conversation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete conversation',
    }
  }
}

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
