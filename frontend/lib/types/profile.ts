// Profile type definitions for the user profile system

export interface UserProfile {
  userId: string
  email: string
  displayName: string
  profilePhotoUrl?: string
  bio?: string
  familyRelationship?: string
  generation?: string
  familyBranch?: string
  joinedDate: string
  isProfilePrivate: boolean
  commentCount: number
  mediaUploadCount: number
  lastActive: string
  createdAt?: string
  updatedAt?: string
  contactEmail?: string
  notifyOnMessage?: boolean
  notifyOnComment?: boolean
  theme?: string
}

export interface ProfileApiResponse {
  success: boolean
  data?: UserProfile | UserProfile[]
  error?: string
  lastEvaluatedKey?: string
}

export interface UpdateProfileRequest {
  displayName?: string
  bio?: string
  familyRelationship?: string
  generation?: string
  familyBranch?: string
  isProfilePrivate?: boolean
  profilePhotoUrl?: string
  contactEmail?: string
  notifyOnMessage?: boolean
  notifyOnComment?: boolean
  theme?: string
}

export interface CommentHistoryItem {
  itemId: string
  commentId: string
  commentText: string
  itemTitle: string
  itemType: 'letter' | 'media'
  createdAt: string
  reactionCount: number
}

export interface CommentHistoryResponse {
  success: boolean
  data?: CommentHistoryItem[]
  error?: string
  lastEvaluatedKey?: string
}
