import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'

const API_URL = PUBLIC_API_GATEWAY_URL?.replace(/\/+$/, '') || ''

export interface ParsedData {
  date?: string
  title?: string
  author?: string
  content?: string
  tags?: string[]
  summary?: string
}

export interface Draft {
  PK: string
  SK: string
  entityType: 'DRAFT_LETTER'
  status: 'PROCESSING' | 'REVIEW' | 'ERROR'
  s3Key: string
  parsedData?: ParsedData
  createdAt: string
  requesterId?: string
  error?: string
}

export interface DraftListResponse {
  drafts: Draft[]
}

export interface PublishData {
  date: string
  title: string
  content: string
  author?: string
  tags?: string[]
  description?: string
}

export interface PublishResponse {
  message: string
  path: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Request failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

/**
 * Extract draft ID from PK (e.g., "DRAFT#abc123" -> "abc123")
 */
export function extractDraftId(pk: string): string {
  return pk.replace('DRAFT#', '')
}

/**
 * List all drafts (admin only)
 */
export async function listDrafts(authToken: string): Promise<Draft[]> {
  const response = await fetch(`${API_URL}/admin/drafts`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await handleResponse<DraftListResponse>(response)
  return data.drafts
}

/**
 * Get a single draft by ID (admin only)
 */
export async function getDraft(draftId: string, authToken: string): Promise<Draft> {
  const response = await fetch(`${API_URL}/admin/drafts/${encodeURIComponent(draftId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  return handleResponse<Draft>(response)
}

/**
 * Delete a draft (admin only)
 */
export async function deleteDraft(draftId: string, authToken: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/drafts/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  await handleResponse<{ message: string }>(response)
}

/**
 * Publish a draft as a letter (admin only)
 */
export async function publishDraft(draftId: string, finalData: PublishData, authToken: string): Promise<PublishResponse> {
  const response = await fetch(`${API_URL}/admin/drafts/${encodeURIComponent(draftId)}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ finalData }),
  })

  return handleResponse<PublishResponse>(response)
}

/**
 * Get presigned URL for viewing draft PDF
 */
export async function getDraftPdfUrl(s3Key: string, authToken: string): Promise<string> {
  const response = await fetch(`${API_URL}/download/presigned-url?key=${encodeURIComponent(s3Key)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await handleResponse<{ downloadUrl: string }>(response)
  return data.downloadUrl
}

/**
 * Format draft status for display
 */
export function formatDraftStatus(status: Draft['status']): { label: string, color: string } {
  switch (status) {
    case 'PROCESSING':
      return { label: 'Processing', color: 'warning' }
    case 'REVIEW':
      return { label: 'Ready for Review', color: 'success' }
    case 'ERROR':
      return { label: 'Error', color: 'error' }
    default:
      return { label: status, color: 'neutral' }
  }
}
