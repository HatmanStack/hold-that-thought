import { cognitoConfig } from './cognito-config'
import { authStore } from './auth-store'
import type { AuthTokens, User } from './auth-store'

export class GoogleOAuthService {
  private getHostedUIUrl(): string {
    const baseUrl = cognitoConfig.hostedUIUrl || 
      `https://${cognitoConfig.hostedUIDomain}.auth.${cognitoConfig.region}.amazoncognito.com`
    
    return baseUrl
  }

  // Generate Google OAuth login URL
  getGoogleLoginUrl(redirectUri?: string): string {
    const baseUrl = this.getHostedUIUrl()
    const redirect = redirectUri || `${window.location.origin}/auth/callback`
    
    const params = new URLSearchParams({
      identity_provider: 'Google',
      redirect_uri: redirect,
      response_type: 'code',
      client_id: cognitoConfig.userPoolWebClientId,
      scope: 'email openid profile aws.cognito.signin.user.admin'
    })

    return `${baseUrl}/oauth2/authorize?${params.toString()}`
  }

  // Generate standard Cognito hosted UI login URL
  getHostedUILoginUrl(redirectUri?: string): string {
    const baseUrl = this.getHostedUIUrl()
    const redirect = redirectUri || `${window.location.origin}/auth/callback`
    
    const params = new URLSearchParams({
      redirect_uri: redirect,
      response_type: 'code',
      client_id: cognitoConfig.userPoolWebClientId,
      scope: 'email openid profile aws.cognito.signin.user.admin'
    })

    return `${baseUrl}/oauth2/authorize?${params.toString()}`
  }

  // Generate logout URL
  getLogoutUrl(redirectUri?: string): string {
    const baseUrl = this.getHostedUIUrl()
    const redirect = redirectUri || `${window.location.origin}/auth/logout`
    
    const params = new URLSearchParams({
      client_id: cognitoConfig.userPoolWebClientId,
      logout_uri: redirect
    })

    return `${baseUrl}/logout?${params.toString()}`
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string, redirectUri?: string): Promise<{ success: boolean; tokens?: AuthTokens; error?: Error }> {
    const baseUrl = this.getHostedUIUrl()
    const redirect = redirectUri || `${window.location.origin}/auth/callback`
    
    try {
      const response = await fetch(`${baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: cognitoConfig.userPoolWebClientId,
          code: code,
          redirect_uri: redirect,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token exchange failed: ${errorText}`)
      }

      const tokenData = await response.json()
      
      const tokens: AuthTokens = {
        accessToken: tokenData.access_token,
        idToken: tokenData.id_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
      }

      return { success: true, tokens }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  // Decode JWT token to get user info
  private decodeJWT(token: string) {
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
    } catch (error) {
      return null
    }
  }

  // Handle OAuth callback and set authentication state
  async handleOAuthCallback(code: string, redirectUri?: string): Promise<{ success: boolean; user?: User; error?: Error }> {
    authStore.setLoading(true)
    
    try {
      const tokenResult = await this.exchangeCodeForTokens(code, redirectUri)
      
      if (!tokenResult.success || !tokenResult.tokens) {
        throw tokenResult.error || new Error('Failed to exchange code for tokens')
      }

      // Decode the ID token to get user info
      const idTokenPayload = this.decodeJWT(tokenResult.tokens.idToken)
      if (!idTokenPayload) {
        throw new Error('Invalid ID token')
      }

      const user: User = {
        email: idTokenPayload.email,
        sub: idTokenPayload.sub,
        email_verified: idTokenPayload.email_verified,
        given_name: idTokenPayload.given_name,
        family_name: idTokenPayload.family_name,
        picture: idTokenPayload.picture,
        ...idTokenPayload,
      }

      authStore.setAuthenticated(user, tokenResult.tokens)
      
      return { success: true, user }
    } catch (error) {
      authStore.clearAuth()
      return { success: false, error: error as Error }
    } finally {
      authStore.setLoading(false)
    }
  }

  // Initiate Google OAuth login
  loginWithGoogle(redirectUri?: string): void {
    const loginUrl = this.getGoogleLoginUrl(redirectUri)
    window.location.href = loginUrl
  }

  // Initiate hosted UI login
  loginWithHostedUI(redirectUri?: string): void {
    const loginUrl = this.getHostedUILoginUrl(redirectUri)
    window.location.href = loginUrl
  }

  // Logout via hosted UI
  logoutViaHostedUI(redirectUri?: string): void {
    const logoutUrl = this.getLogoutUrl(redirectUri)
    window.location.href = logoutUrl
  }
}

export const googleOAuth = new GoogleOAuthService()
