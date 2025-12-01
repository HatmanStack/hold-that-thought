import type { AuthState, AuthTokens, User } from './auth-store'
import { authStore } from './auth-store'
import { cognitoAuth } from './cognito-client'

// JWT token decoder (simple implementation)
function decodeJWT(token: string) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    )
    return JSON.parse(jsonPayload)
  }
  catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}

export class AuthService {
  private refreshTimer: NodeJS.Timeout | null = null

  async signIn(email: string, password: string) {
    authStore.setLoading(true)

    try {
      const result = await cognitoAuth.signIn(email, password)

      if (!result.success) {
        throw result.error
      }

      const authResult = result.data?.AuthenticationResult
      if (!authResult?.AccessToken || !authResult?.IdToken || !authResult?.RefreshToken) {
        throw new Error('Invalid authentication response')
      }

      // Decode the ID token to get user info
      const idTokenPayload = decodeJWT(authResult.IdToken)
      if (!idTokenPayload) {
        throw new Error('Invalid ID token')
      }

      const user: User = {
        email: idTokenPayload.email,
        sub: idTokenPayload.sub,
        email_verified: idTokenPayload.email_verified,
        ...idTokenPayload,
      }

      const tokens: AuthTokens = {
        accessToken: authResult.AccessToken,
        idToken: authResult.IdToken,
        refreshToken: authResult.RefreshToken,
        expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
      }

      authStore.setAuthenticated(user, tokens)
      this.scheduleTokenRefresh(tokens.expiresAt)

      return { success: true, user, tokens }
    }
    catch (error) {
      console.error('Sign in error:', error)
      authStore.clearAuth()
      throw error
    }
    finally {
      authStore.setLoading(false)
    }
  }

  async refreshTokens() {
    const currentState = await new Promise<AuthState>((resolve) => {
      let unsubscribe: (() => void) | undefined
      unsubscribe = authStore.subscribe((state) => {
        if (unsubscribe)
          unsubscribe()
        resolve(state)
      })
    })

    if (!currentState.tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const result = await cognitoAuth.refreshToken(currentState.tokens.refreshToken)

      if (!result.success) {
        throw result.error
      }

      const authResult = result.data?.AuthenticationResult
      if (!authResult?.AccessToken || !authResult?.IdToken) {
        throw new Error('Invalid refresh response')
      }

      const newTokens: AuthTokens = {
        accessToken: authResult.AccessToken,
        idToken: authResult.IdToken,
        refreshToken: currentState.tokens.refreshToken, // Refresh token stays the same
        expiresAt: Date.now() + (authResult.ExpiresIn || 3600) * 1000,
      }

      authStore.updateTokens(newTokens)
      this.scheduleTokenRefresh(newTokens.expiresAt)

      return newTokens
    }
    catch (error) {
      console.error('Token refresh error:', error)
      this.signOut()
      throw error
    }
  }

  async signOut() {
    const currentState = await new Promise<AuthState>((resolve) => {
      let unsubscribe: (() => void) | undefined
      unsubscribe = authStore.subscribe((state) => {
        if (unsubscribe)
          unsubscribe()
        resolve(state)
      })
    })

    if (currentState.tokens?.accessToken) {
      try {
        await cognitoAuth.signOut(currentState.tokens.accessToken)
      }
      catch (error) {
        console.error('Sign out error:', error)
      }
    }

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    authStore.clearAuth()
  }

  private scheduleTokenRefresh(expiresAt: number) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    // Refresh 5 minutes before expiration
    const refreshTime = expiresAt - Date.now() - 5 * 60 * 1000

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTokens().catch(console.error)
      }, refreshTime)
    }
  }

  // Get current access token, refreshing if necessary
  async getValidAccessToken(): Promise<string | null> {
    const currentState = await new Promise<AuthState>((resolve) => {
      let unsubscribe: (() => void) | undefined
      unsubscribe = authStore.subscribe((state) => {
        if (unsubscribe)
          unsubscribe()
        resolve(state)
      })
    })

    if (!currentState.tokens) {
      return null
    }

    // Check if token is about to expire (within 5 minutes)
    if (currentState.tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
      try {
        const newTokens = await this.refreshTokens()
        return newTokens.accessToken
      }
      catch (error) {
        return null
      }
    }

    return currentState.tokens.accessToken
  }
}

export const authService = new AuthService()
