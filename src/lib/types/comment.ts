// Comment and Reaction type definitions for the commenting system

export interface Comment {
  itemId: string
  commentId: string
  userId: string
  userName: string
  userPhotoUrl?: string
  commentText: string
  createdAt: string
  updatedAt?: string
  isEdited: boolean
  editHistory?: Array<{ text: string; timestamp: string }>
  reactionCount: number
  isDeleted: boolean
  itemType: 'letter' | 'media'
  itemTitle: string
}

export interface Reaction {
  commentId: string
  userId: string
  reactionType: 'like'
  createdAt: string
}

export interface CommentApiResponse {
  success: boolean
  data?: Comment | Comment[]
  error?: string
  lastEvaluatedKey?: string
}

export interface ReactionApiResponse {
  success: boolean
  data?: Reaction | Reaction[]
  error?: string
}

export interface CreateCommentRequest {
  commentText: string
  itemType: 'letter' | 'media'
  itemTitle: string
}

export interface UpdateCommentRequest {
  commentText: string
}
