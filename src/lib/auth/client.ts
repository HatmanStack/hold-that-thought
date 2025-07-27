import { browser } from '$app/environment'
import { 
  PUBLIC_COGNITO_USER_POOL_ID,
  PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
  PUBLIC_AWS_REGION 
} from '$env/static/public'
import { authStore } from './auth-store'

export interface CognitoTokens {
  idToken: string
  accessToken: string
  refreshToken: string
}

export interface UserInfo {
  id: string
  email: string
  username: string
  groups: string[]
  given_name?: string
  family_name?: string
  picture?: string
}

/**
 * Get stored tokens from localStorage
 */
export function getStoredTokens(): CognitoTokens | null {
  if (!browser) return null
  
  try {
    const idToken = localStorage.getItem('cognito_id_token')
    const accessToken = localStorage.getItem('cognito_access_token')
    const refreshToken = localStorage.getItem('cognito_refresh_token')
    
    if (!idToken || !accessToken || !refreshToken) return null
    
    return { idToken, accessToken, refreshToken }
  } catch {
    return null
  }
}

/**
 * Store tokens in localStorage
 */
export function storeTokens(tokens: CognitoTokens): void {
  if (!browser) return
  
  localStorage.setItem('cognito_id_token', tokens.idToken)
  localStorage.setItem('cognito_access_token', tokens.accessToken)
  localStorage.setItem('cognito_refresh_token', tokens.refreshToken)
}

/**
 * Clear stored tokens
 */
export function clearTokens(): void {
  if (!browser) return
  
  localStorage.removeItem('cognito_id_token')
  localStorage.removeItem('cognito_access_token')
  localStorage.removeItem('cognito_refresh_token')
}

/**
 * Decode JWT payload (client-side only, for display purposes)
 * Note: This doesn't verify the token - server-side verification is still required
 */
export function decodeJWTPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Get user info from stored ID token (client-side only)
 */
export function getUserInfo(): UserInfo | null {
  const tokens = getStoredTokens()
  if (!tokens) return null
  
  const payload = decodeJWTPayload(tokens.idToken)
  if (!payload) return null
  
  return {
    id: payload.sub,
    email: payload.email,
    username: payload['cognito:username'],
    groups: payload['cognito:groups'] || [],
    given_name: payload.given_name,
    family_name: payload.family_name,
    picture: payload.picture
  }
}

/**
 * Check if user is in ApprovedUsers group (client-side)
 */
export function isUserApproved(): boolean {
  const userInfo = getUserInfo()
  return userInfo?.groups.includes('ApprovedUsers') ?? false
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const tokens = getStoredTokens()
  if (!tokens) {
    throw new Error('No authentication tokens available')
  }
  
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${tokens.idToken}`)
  
  return fetch(url, {
    ...options,
    headers
  })
}

/**
 * Refresh the session using the refresh token
 */
export async function refreshSession(): Promise<void> {
  const tokens = getStoredTokens()
  if (!tokens?.refreshToken) {
    throw new Error('No refresh token available')
  }

  const domain = `${PUBLIC_COGNITO_USER_POOL_ID.split('_')[0]}-${PUBLIC_COGNITO_USER_POOL_ID.split('_')[1]}`
  const tokenEndpoint = `https://${domain}.auth.${PUBLIC_AWS_REGION}.amazoncognito.com/oauth2/token`

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
        refresh_token: tokens.refreshToken
      })
    })

    if (!response.ok) {
      throw new Error('Failed to refresh token')
    }

    const data = await response.json()
    
    // Update tokens in localStorage and auth store
    const newTokens: CognitoTokens = {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: tokens.refreshToken // Keep existing refresh token
    }
    
    storeTokens(newTokens)
    
    // Update auth store with new tokens and user info
    const userInfo = getUserInfo()
    if (userInfo) {
      authStore.setAuthenticated(userInfo, newTokens)
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
    // Clear tokens and auth store on refresh failure
    clearTokens()
    authStore.clearAuth()
    throw error
  }
}
