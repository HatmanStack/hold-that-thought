import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'

const API_URL = PUBLIC_API_GATEWAY_URL || ''

export interface Letter {
  date: string
  title: string
  originalTitle?: string
  content: string
  pdfKey?: string
  createdAt: string
  updatedAt: string
  lastEditedBy?: string
  versionCount: number
}

export interface LetterListItem {
  date: string
  title: string
  originalTitle?: string
  updatedAt: string
}

export interface LetterVersion {
  timestamp: string
  versionNumber: number
  editedBy: string
  editedAt: string
}

export interface LettersListResponse {
  items: LetterListItem[]
  nextCursor: string | null
}

export interface VersionsResponse {
  versions: LetterVersion[]
}

export interface PdfUrlResponse {
  downloadUrl: string
  filename: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Request failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export async function listLetters(
  authToken: string,
  limit = 50,
  cursor?: string,
): Promise<LettersListResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor)
    params.set('cursor', cursor)

  const response = await fetch(`${API_URL}/letters?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  return handleResponse<LettersListResponse>(response)
}

export async function getLetter(date: string, authToken: string): Promise<Letter> {
  const response = await fetch(`${API_URL}/letters/${encodeURIComponent(date)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  return handleResponse<Letter>(response)
}

export async function updateLetter(
  date: string,
  content: string,
  title: string | undefined,
  authToken: string,
): Promise<Letter> {
  const response = await fetch(`${API_URL}/letters/${encodeURIComponent(date)}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, title }),
  })

  return handleResponse<Letter>(response)
}

export async function getVersions(date: string, authToken: string): Promise<LetterVersion[]> {
  const response = await fetch(`${API_URL}/letters/${encodeURIComponent(date)}/versions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await handleResponse<VersionsResponse>(response)
  return data.versions
}

export async function revertToVersion(
  date: string,
  versionTimestamp: string,
  authToken: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/letters/${encodeURIComponent(date)}/revert`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ versionTimestamp }),
  })

  await handleResponse<{ message: string }>(response)
}

export async function getPdfUrl(date: string, authToken: string): Promise<string> {
  const response = await fetch(`${API_URL}/letters/${encodeURIComponent(date)}/pdf`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await handleResponse<PdfUrlResponse>(response)
  return data.downloadUrl
}
