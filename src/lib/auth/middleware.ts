import type { RequestEvent } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'
import { verifyJWT, isUserApproved, extractTokenFromHeader, type CognitoJWTPayload } from './jwt'

export interface AuthenticatedUser {
  id: string
  email: string
  groups: string[]
  username: string
  given_name?: string
  family_name?: string
  picture?: string
}

/**
 * Authenticate and authorize a request
 * Throws SvelteKit error if authentication/authorization fails
 */
export async function requireApprovedUser(event: RequestEvent): Promise<AuthenticatedUser> {
  const authHeader = event.request.headers.get('Authorization')
  const token = extractTokenFromHeader(authHeader)
  
  if (!token) {
    throw error(401, {
      message: 'Authentication required',
      code: 'MISSING_TOKEN'
    })
  }
  
  let payload: CognitoJWTPayload
  try {
    payload = await verifyJWT(token)
  } catch (err) {
    throw error(401, {
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    })
  }
  
  if (!isUserApproved(payload)) {
    throw error(403, {
      message: 'Access denied. User is not in the ApprovedUsers group.',
      code: 'INSUFFICIENT_PERMISSIONS'
    })
  }
  
  return {
    id: payload.sub,
    email: payload.email,
    groups: payload['cognito:groups'] || [],
    username: payload['cognito:username'],
    given_name: payload.given_name,
    family_name: payload.family_name,
    picture: payload.picture
  }
}

/**
 * Get authenticated user without group requirement
 * Returns user if authenticated, null otherwise
 */
export async function getAuthenticatedUser(event: RequestEvent): Promise<AuthenticatedUser | null> {
  const authHeader = event.request.headers.get('Authorization')
  const token = extractTokenFromHeader(authHeader)
  
  if (!token) return null
  
  try {
    const payload = await verifyJWT(token)
    return {
      id: payload.sub,
      email: payload.email,
      groups: payload['cognito:groups'] || [],
      username: payload['cognito:username'],
      given_name: payload.given_name,
      family_name: payload.family_name,
      picture: payload.picture
    }
  } catch {
    return null
  }
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 * Does not throw errors for missing/invalid tokens or configuration
 */
export async function getOptionalUser(event: RequestEvent): Promise<AuthenticatedUser | null> {
  try {
    return await requireApprovedUser(event)
  } catch (err) {
    // Log configuration errors in development for debugging
    if (err instanceof Error && err.message.includes('not configured')) {
      console.warn('⚠️  Cognito authentication not configured:', err.message)
    }
    return null
  }
}

/**
 * Check if request has valid authentication (without group check)
 */
export async function isAuthenticated(event: RequestEvent): Promise<boolean> {
  const authHeader = event.request.headers.get('Authorization')
  const token = extractTokenFromHeader(authHeader)
  
  if (!token) return false
  
  try {
    await verifyJWT(token)
    return true
  } catch {
    return false
  }
}