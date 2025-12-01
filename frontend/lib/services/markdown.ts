import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'
import { authStore } from '$lib/auth/auth-store'
import { refreshSession } from '$lib/auth/client'
import { get } from 'svelte/store'

function extractFrontmatter(content: string) {
  const match = content.match(/^---([\s\S]*?)---([\s\S]*)$/)
  if (!match)
    return { frontmatter: '', content }
  return {
    frontmatter: match[1].trim(),
    content: match[2].trim(),
  }
}

function combineFrontmatterAndContent(frontmatter: string, content: string) {
  return `---\n${frontmatter}\n---\n\n${content}`
}

async function checkAuthentication(): Promise<{ authenticated: boolean, token?: string }> {
  const auth = get(authStore)

  if (!auth.isAuthenticated || !auth.tokens) {
    try {
      await refreshSession()
      const newAuth = get(authStore)
      if (!newAuth.isAuthenticated || !newAuth.tokens) {
        return { authenticated: false }
      }
      return { authenticated: true, token: newAuth.tokens.idToken }
    }
    catch (error) {
      console.warn('Authentication refresh failed:', error)
      return { authenticated: false }
    }
  }

  return { authenticated: true, token: auth.tokens.idToken }
}

export async function getMarkdownContent(letterPath: string): Promise<string> {
  try {
    console.log('Getting markdown content for path:', letterPath)
    const response = await fetch(`/api/markdown?path=${encodeURIComponent(letterPath)}`)

    if (!response.ok) {
      console.error('Failed to load markdown:', response.status)
      throw new Error(`Failed to load markdown: ${response.status}`)
    }

    const data = await response.json()
    console.log('Successfully loaded markdown content')

    // Extract just the content part for editing
    const { content } = extractFrontmatter(data.content)
    return content
  }
  catch (error) {
    console.error('Error loading markdown content:', error)
    throw error
  }
}

export async function saveMarkdownContent(path: string, content: string): Promise<boolean> {
  try {
    console.log('Saving markdown content for path:', path)

    // First, get the original content to preserve frontmatter
    const response = await fetch(`/api/markdown?path=${encodeURIComponent(path)}`)
    if (!response.ok) {
      throw new Error('Failed to get original content')
    }
    const data = await response.json()
    const { frontmatter } = extractFrontmatter(data.content)

    // Combine frontmatter with new content
    const fullContent = combineFrontmatterAndContent(frontmatter, content.trim())
    console.log('Combined content preview:', `${fullContent.substring(0, 100)}...`)

    // Save locally first
    const localResponse = await fetch('/api/markdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        content: fullContent,
      }),
    })

    if (!localResponse.ok) {
      console.error('Failed to save locally:', localResponse.status)
      throw new Error(`Failed to save locally: ${localResponse.status}`)
    }

    console.log('Successfully saved content locally')

    // Try to save to S3 as backup only if authenticated
    try {
      const { authenticated, token } = await checkAuthentication()

      if (!authenticated) {
        console.warn('Not authenticated for S3 backup - skipping')
        return true // Still return success since local save worked
      }

      console.log('Attempting S3 backup to:', `${PUBLIC_API_GATEWAY_URL}/pdf-download`)

      const s3Payload = {
        type: 'markdown',
        key: path,
        content: fullContent,
      }
      console.log('S3 backup payload:', s3Payload)

      const s3Response = await fetch(`${PUBLIC_API_GATEWAY_URL}/pdf-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(s3Payload),
      })

      if (!s3Response.ok) {
        const errorText = await s3Response.text()
        console.warn('S3 backup failed with status:', s3Response.status)
        console.warn('S3 error response:', errorText)
      }
      else {
        const responseData = await s3Response.json()
        console.log('S3 backup successful:', responseData)
      }
    }
    catch (s3Error) {
      console.warn('S3 backup failed:', s3Error)
      const message = s3Error instanceof Error ? s3Error.message : 'Unknown error'
      console.warn('Error details:', message)
      // Don't throw error for S3 backup failure
    }

    return true
  }
  catch (error) {
    console.error('Error saving markdown content:', error)
    throw error
  }
}
