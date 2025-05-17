import type { AuthConfig } from '$lib/types/auth'

export const auth: AuthConfig = {
  region: 'us-east-1', // AWS region where your Cognito User Pool is located
  userPoolId: 'us-east-1_xxxxxxxxx', // Replace with your Cognito User Pool ID
  userPoolWebClientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with your App Client ID
  oauth: {
    domain: 'your-domain.auth.us-east-1.amazoncognito.com', // Replace with your Cognito domain
    scope: ['email', 'openid', 'profile'],
    redirectSignIn: 'https://carolfae.fun/auth/callback', // Replace with your actual domain
    redirectSignOut: 'https://carolfae.fun/', // Replace with your actual domain
    responseType: 'code' // or 'token'
  },
  // Add any additional configuration options here
}