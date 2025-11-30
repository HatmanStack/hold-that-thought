// Message and Conversation type definitions for the messaging system

export interface Message {
  conversationId: string
  messageId: string
  senderId: string
  senderName: string
  messageText: string
  attachments?: Attachment[]
  createdAt: string
  conversationType: 'direct' | 'group'
  participants: string[]
}

export interface Conversation {
  conversationId: string
  conversationType: 'direct' | 'group'
  participantIds: string[]
  participantNames: string[]
  lastMessageAt: string
  unreadCount: number
  conversationTitle?: string // For groups
  lastMessagePreview?: string // For display in conversation list
}

export interface Attachment {
  s3Key: string
  filename: string
  contentType: string
  size: number
  url?: string // Presigned download URL
  thumbnailUrl?: string // For images
}

export interface MessageApiResponse {
  success: boolean
  data?: Message | Message[]
  error?: string
  lastEvaluatedKey?: string
}

export interface ConversationApiResponse {
  success: boolean
  data?: Conversation | Conversation[]
  error?: string
  lastEvaluatedKey?: string
}

export interface CreateConversationRequest {
  participantIds: string[]
  messageText: string
  conversationTitle?: string // Optional for groups
}

export interface SendMessageRequest {
  messageText: string
  attachments?: Attachment[]
}

export interface UploadAttachmentResponse {
  success: boolean
  data?: {
    uploadUrl: string // Presigned URL for upload
    s3Key: string // S3 key for reference
  }
  error?: string
}
