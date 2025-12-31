import { getApiBaseUrl } from '$lib/utils/api-url'
import { authStore } from '$lib/auth/auth-store'
import { refreshSession } from '$lib/auth/client'
import { get } from 'svelte/store'

interface ContentListItem {
  key: string
  lastModified: string
  size: number
  isDirectory: boolean
}

async function getAuthToken(): Promise<string | null> {
  const auth = get(authStore)

  if (!auth.isAuthenticated || !auth.tokens) {
    try {
      await refreshSession()
      const newAuth = get(authStore)
      if (!newAuth.isAuthenticated || !newAuth.tokens) {
        return null
      }
      return newAuth.tokens.idToken
    }
    catch (error) {
      console.warn('Session refresh failed:', error)
      return null
    }
  }

  return auth.tokens.idToken
}

export class ContentService {
  private baseUrl: string

  constructor() {
    this.baseUrl = getApiBaseUrl()
  }

  async getContent(path: string): Promise<string> {
    let s3Key = path

    if (s3Key.startsWith('/')) {
      s3Key = s3Key.substring(1)
    }

    if (!s3Key.startsWith('letters/')) {
      s3Key = `letters/${s3Key}`
    }
    if (!s3Key.endsWith('/+page.svelte.md')) {
      s3Key = `${s3Key}/+page.svelte.md`
    }

    const response = await fetch(`${this.baseUrl}/pdf-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: s3Key,
        type: 'markdown',
      }),
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Content not found: ${path}`)
      }
      throw new Error(`Failed to get content: ${response.status}`)
    }

    const data = await response.json()
    return data.content || data.body || data
  }

  async saveContent(path: string, content: string): Promise<boolean> {
    const token = await getAuthToken()
    if (!token) {
      throw new Error('Authentication required to save content')
    }

    let s3Key = path

    if (s3Key.startsWith('/')) {
      s3Key = s3Key.substring(1)
    }

    if (!s3Key.startsWith('letters/')) {
      s3Key = `letters/${s3Key}`
    }
    if (!s3Key.endsWith('/+page.svelte.md')) {
      s3Key = `${s3Key}/+page.svelte.md`
    }

    const response = await fetch(`${this.baseUrl}/pdf-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'markdown',
        key: s3Key,
        content,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to save content: ${response.status}`)
    }

    return true
  }

  async listContent(_prefix: string = ''): Promise<ContentListItem[]> {
    return []
  }

  async deleteContent(_path: string): Promise<boolean> {
    throw new Error('Delete functionality not implemented')
  }

  async contentExists(path: string): Promise<boolean> {
    try {
      await this.getContent(path)
      return true
    }
    catch (error) {
      console.warn('Content does not exist:', path, error)
      return false
    }
  }
}

export const contentService = new ContentService()
