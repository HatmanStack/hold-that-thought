import {
  PUBLIC_API_GATEWAY_URL,
  PUBLIC_AWS_REGION,
  PUBLIC_COGNITO_HOSTED_UI_DOMAIN,
  PUBLIC_COGNITO_HOSTED_UI_URL,
  PUBLIC_COGNITO_IDENTITY_POOL_ID,
  PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
  PUBLIC_COGNITO_USER_POOL_ID,
} from '$env/static/public'

// AWS Cognito Configuration
export const cognitoConfig = {
  region: PUBLIC_AWS_REGION || 'us-east-1',
  userPoolId: PUBLIC_COGNITO_USER_POOL_ID || '',
  userPoolWebClientId: PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '',
  identityPoolId: PUBLIC_COGNITO_IDENTITY_POOL_ID || '',
  apiGatewayUrl: PUBLIC_API_GATEWAY_URL || '',
  hostedUIUrl: PUBLIC_COGNITO_HOSTED_UI_URL || '',
  hostedUIDomain: PUBLIC_COGNITO_HOSTED_UI_DOMAIN || '',
}

// Check if Cognito is properly configured (not placeholder values)
export function isCognitoConfigured(): boolean {
  const { userPoolId, userPoolWebClientId, region, hostedUIUrl } = cognitoConfig

  // Check for empty or placeholder values
  const isPlaceholder = (val: string) =>
    !val || val.includes('xxxxxxxxx') || val.includes('your-') || val === ''

  return !!(
    !isPlaceholder(userPoolId)
    && !isPlaceholder(userPoolWebClientId)
    && region
    && !isPlaceholder(hostedUIUrl)
  )
}

// Validate required environment variables
export function validateCognitoConfig() {
  const missing: string[] = []

  if (!PUBLIC_COGNITO_USER_POOL_ID)
    missing.push('PUBLIC_COGNITO_USER_POOL_ID')
  if (!PUBLIC_COGNITO_USER_POOL_CLIENT_ID)
    missing.push('PUBLIC_COGNITO_USER_POOL_CLIENT_ID')
  if (!PUBLIC_AWS_REGION)
    missing.push('PUBLIC_AWS_REGION')

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
