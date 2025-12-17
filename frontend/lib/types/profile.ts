// Profile type definitions for the user profile system

/**
 * Represents a user's relationship to someone in the family archive.
 * Used to provide context for chat queries (e.g., "What did my grandmother write about?")
 */
export interface FamilyRelationship {
  id: string // UUID for stable identification
  type: string // Predefined type or "Other"
  customType?: string // Only used when type === "Other"
  name: string // Person's name as it appears in archive
  createdAt: string // ISO timestamp
}

/**
 * Predefined relationship types organized by category.
 * The "Other" option allows custom entries.
 */
export const RELATIONSHIP_TYPES = [
  // Immediate family
  'Mother',
  'Father',
  'Sibling',
  'Spouse/Partner',
  'Child',
  // Grandparents
  'Grandmother (maternal)',
  'Grandfather (maternal)',
  'Grandmother (paternal)',
  'Grandfather (paternal)',
  // Extended family
  'Aunt',
  'Uncle',
  'Cousin',
  'Niece',
  'Nephew',
  // Great-grandparents
  'Great-grandmother (maternal)',
  'Great-grandfather (maternal)',
  'Great-grandmother (paternal)',
  'Great-grandfather (paternal)',
  // Custom option
  'Other',
] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

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
  familyRelationships?: FamilyRelationship[]
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
  familyRelationships?: FamilyRelationship[]
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
