import type { PageServerLoad } from './$types'
import {
  PUBLIC_AWS_REGION,
  PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
  PUBLIC_COGNITO_USER_POOL_ID,
} from '$env/static/public'

export const load: PageServerLoad = async (event) => {
  return {
    user: event.locals.user,
    cognitoConfig: {
      userPoolId: PUBLIC_COGNITO_USER_POOL_ID || null,
      region: PUBLIC_AWS_REGION || null,
      clientId: PUBLIC_COGNITO_USER_POOL_CLIENT_ID || null,
      isConfigured: !!(PUBLIC_COGNITO_USER_POOL_ID && PUBLIC_AWS_REGION && PUBLIC_COGNITO_USER_POOL_CLIENT_ID),
    },
  }
}
