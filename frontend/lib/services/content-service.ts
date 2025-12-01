import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'
import { authStore } from '$lib/auth/auth-store'
import { refreshSession } from '$lib/auth/client'
import { get } from 'svelte/store'

interface ContentItem {
  key: string
  content: string
  lastModified?: string
  size?: number
}

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
      console.warn('Authentication refresh failed:', error)
      return null
    }
  }

  return auth.tokens.idToken
}

export class ContentService {
  private baseUrl: string

  constructor() {
    this.baseUrl = PUBLIC_API_GATEWAY_URL
  }

  /**
   * Get content from S3 via your existing Lambda
   */
  async getContent(path: string): Promise<string> {
    try {
      console.log('Getting content for path:', path)

      // Convert route path to S3 key format
      let s3Key = path

      // Remove leading slash if present
      if (s3Key.startsWith('/')) {
        s3Key = s3Key.substring(1)
      }

      // Add urara/ prefix and +page.svelte.md suffix for S3 storage format
      if (!s3Key.startsWith('urara/')) {
        s3Key = `urara/${s3Key}`
      }
      if (!s3Key.endsWith('/+page.svelte.md')) {
        s3Key = `${s3Key}/+page.svelte.md`
      }

      console.log('Converted to S3 key:', s3Key)

      const response = await fetch(`${this.baseUrl}/pdf-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: s3Key,
          type: 'markdown', // Request markdown content from S3
        }),
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Content not found: ${path}`)
        }
        const errorText = await response.text()
        console.error('Lambda response error:', response.status, errorText)
        throw new Error(`Failed to get content: ${response.status}`)
      }

      const data = await response.json()
      console.log('Successfully retrieved content from Lambda')
      return data.content || data.body || data
    }
    catch (error) {
      console.error('Error getting content:', error)
      throw error
    }
  }

  /**
   * Save content to S3 via your existing Lambda
   */
  async saveContent(path: string, content: string): Promise<boolean> {
    try {
      console.log('Saving content for path:', path)

      const token = await getAuthToken()
      if (!token) {
        throw new Error('Authentication required to save content')
      }

      // Convert route path to S3 key format
      let s3Key = path

      // Remove leading slash if present
      if (s3Key.startsWith('/')) {
        s3Key = s3Key.substring(1)
      }

      // Add urara/ prefix and +page.svelte.md suffix for S3 storage format
      if (!s3Key.startsWith('urara/')) {
        s3Key = `urara/${s3Key}`
      }
      if (!s3Key.endsWith('/+page.svelte.md')) {
        s3Key = `${s3Key}/+page.svelte.md`
      }

      console.log('Converted to S3 key for save:', s3Key)

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
        const errorText = await response.text()
        console.error('Save failed:', response.status, errorText)
        throw new Error(`Failed to save content: ${response.status}`)
      }

      const result = await response.json()
      console.log('Content saved successfully:', result)
      return true
    }
    catch (error) {
      console.error('Error saving content:', error)
      throw error
    }
  }

  /**
   * List content items in a directory (placeholder - would need Lambda enhancement)
   */
  async listContent(prefix: string = ''): Promise<ContentListItem[]> {
    try {
      console.log('Listing content with prefix:', prefix)

      // For now, return empty array since your Lambda doesn't have list functionality
      // You could enhance your Lambda to support listing operations
      console.warn('List functionality not implemented in Lambda yet')
      return []
    }
    catch (error) {
      console.error('Error listing content:', error)
      throw error
    }
  }

  /**
   * Delete content from S3 (would need Lambda enhancement)
   */
  async deleteContent(path: string): Promise<boolean> {
    try {
      console.log('Delete content for path:', path)

      // For now, throw error since your Lambda doesn't have delete functionality
      // You could enhance your Lambda to support delete operations
      throw new Error('Delete functionality not implemented in Lambda yet')
    }
    catch (error) {
      console.error('Error deleting content:', error)
      throw error
    }
  }

  /**
   * Check if content exists
   */
  async contentExists(path: string): Promise<boolean> {
    try {
      await this.getContent(path)
      return true
    }
    catch (error) {
      return false
    }
  }
}

// Export singleton instance
export const contentService = new ContentService()
