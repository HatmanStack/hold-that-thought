// Comment and Reaction type definitions for the commenting system

export interface Comment {
  itemId: string
  commentId: string
  authorId: string
  authorEmail?: string
  content: string
  createdAt: string
  updatedAt?: string
  isEdited?: boolean
  reactionCount?: number
  userHasReacted?: boolean
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
  content: string
  itemType: 'letter' | 'media'
  itemTitle: string
}

export interface UpdateCommentRequest {
  content: string
}
