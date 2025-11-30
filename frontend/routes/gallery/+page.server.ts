import type { PageServerLoad } from './$types'
import { getOptionalUser } from '$lib/auth/middleware'
import { 
  PUBLIC_COGNITO_USER_POOL_ID, 
  PUBLIC_AWS_REGION 
} from '$env/static/public'

export const load: PageServerLoad = async (event) => {
  // Check if Cognito is configured
  const isCognitoConfigured = !!(PUBLIC_COGNITO_USER_POOL_ID && PUBLIC_AWS_REGION)
  
  if (!isCognitoConfigured) {
    // In development mode, allow access but return null user
    return {
      user: null,
      developmentMode: true,
      cognitoConfigured: false
    }
  }
  
  // Use getOptionalUser instead of requireApprovedUser to match home page behavior
  const user = await getOptionalUser(event)
  
  return {
    user: user ? {
      id: user.id,
      email: user.email,
      username: user.username,
      groups: user.groups
    } : null,
    developmentMode: false,
    cognitoConfigured: true
  }
}