import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'

export interface AuthTokens {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresAt: number
}

export interface User {
  email: string
  sub: string
  email_verified: boolean
  [key: string]: any
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  tokens: AuthTokens | null
  loading: boolean
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  loading: true,
}

// Create the main auth store
function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState)

  return {
    subscribe,
    
    // Initialize auth state from localStorage
    init: () => {
      if (!browser) return
      
      // Check if user intentionally signed out
      const signedOut = localStorage.getItem('auth_signed_out')
      if (signedOut === 'true') {
        set({ ...initialState, loading: false })
        return
      }
      
      try {
        const storedTokens = localStorage.getItem('auth_tokens')
        const storedUser = localStorage.getItem('auth_user')
        
        if (storedTokens && storedUser) {
          const tokens: AuthTokens = JSON.parse(storedTokens)
          const user: User = JSON.parse(storedUser)
          
          // Check if tokens are still valid
          if (tokens.expiresAt > Date.now()) {
            set({
              isAuthenticated: true,
              user,
              tokens,
              loading: false,
            })
            return
          } else {
            // Tokens expired, clear storage
            localStorage.removeItem('auth_tokens')
            localStorage.removeItem('auth_user')
          }
        }
      } catch (error) {
        console.error('Error initializing auth state:', error)
        localStorage.removeItem('auth_tokens')
        localStorage.removeItem('auth_user')
      }
      
      set({ ...initialState, loading: false })
    },

    // Set authenticated state
    setAuthenticated: (user: User, tokens: AuthTokens) => {
      if (browser) {
        // Clear signout flag when user signs in
        localStorage.removeItem('auth_signed_out')
        localStorage.setItem('auth_tokens', JSON.stringify(tokens))
        localStorage.setItem('auth_user', JSON.stringify(user))
      }
      
      set({
        isAuthenticated: true,
        user,
        tokens,
        loading: false,
      })
    },

    // Update tokens (for refresh)
    updateTokens: (tokens: AuthTokens) => {
      if (browser) {
        localStorage.setItem('auth_tokens', JSON.stringify(tokens))
      }
      
      update(state => ({
        ...state,
        tokens,
      }))
    },

    // Clear auth state
    clearAuth: () => {
      if (browser) {
        // Set signout flag to prevent auto re-authentication
        localStorage.setItem('auth_signed_out', 'true')
        
        // Clear auth store tokens
        localStorage.removeItem('auth_tokens')
        localStorage.removeItem('auth_user')
        
        // Also clear client utility tokens
        localStorage.removeItem('cognito_id_token')
        localStorage.removeItem('cognito_access_token')
        localStorage.removeItem('cognito_refresh_token')
      }
      
      set({
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
      })
    },

    // Set loading state
    setLoading: (loading: boolean) => {
      update(state => ({ ...state, loading }))
    },
  }
}

export const authStore = createAuthStore()

// Derived stores for convenience
export const isAuthenticated = derived(authStore, $auth => $auth.isAuthenticated)
export const currentUser = derived(authStore, $auth => $auth.user)
export const authTokens = derived(authStore, $auth => $auth.tokens)
export const authLoading = derived(authStore, $auth => $auth.loading)