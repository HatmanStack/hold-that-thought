import { browser } from '$app/environment'
import { goto } from '$app/navigation'
import { 
  signIn, 
  signUp, 
  signOut as cognitoSignOut, 
  confirmSignUp, 
  forgotPassword, 
  resetPassword, 
  getCurrentUser, 
  isAuthenticated as checkAuthenticated 
} from './cognitoClient'
import { userStore } from '$lib/stores/user'
import type { 
  LoginCredentials, 
  SignupCredentials, 
  ResetPasswordCredentials, 
  ForgotPasswordCredentials 
} from '$lib/types/auth'

/**
 * Initialize the authentication state
 */
export const initAuth = async (): Promise<void> => {
  if (!browser) return
  
  userStore.update(state => ({ ...state, isLoading: true }))
  
  try {
    const isAuth = await checkAuthenticated()
    
    if (isAuth) {
      const user = await getCurrentUser()
      userStore.update(state => ({
        ...state,
        isAuthenticated: true,
        user,
        isLoading: false
      }))
    } else {
      userStore.update(state => ({
        ...state,
        isAuthenticated: false,
        user: null,
        isLoading: false
      }))
    }
  } catch (error) {
    userStore.update(state => ({
      ...state,
      isAuthenticated: false,
      user: null,
      error: error instanceof Error ? error.message : 'Authentication error',
      isLoading: false
    }))
  }
}

/**
 * Login a user with username and password
 */
export const login = async (credentials: LoginCredentials): Promise<void> => {
  userStore.update(state => ({ ...state, isLoading: true, error: null }))
  
  try {
    const session = await signIn(credentials)
    const user = await getCurrentUser()
    
    userStore.update(state => ({
      ...state,
      isAuthenticated: true,
      user,
      token: session.getIdToken().getJwtToken(),
      refreshToken: session.getRefreshToken().getToken(),
      error: null,
      isLoading: false
    }))
    
    // Redirect to home page after successful login
    goto('/')
  } catch (error) {
    userStore.update(state => ({
      ...state,
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Login failed',
      isLoading: false
    }))
  }
}

/**
 * Register a new user
 */
export const register = async (credentials: SignupCredentials): Promise<void> => {
  userStore.update(state => ({ ...state, isLoading: true, error: null }))
  
  try {
    await signUp(credentials)
    
    userStore.update(state => ({
      ...state,
      isLoading: false
    }))
    
    // Redirect to confirmation page
    goto('/auth?mode=confirm&username=' + encodeURIComponent(credentials.username))
  } catch (error) {
    userStore.update(state => ({
      ...state,
      error: error instanceof Error ? error.message : 'Registration failed',
      isLoading: false
    }))
  }
}

/**
 * Confirm a user's registration
 */
export const confirm = async (username: string, code: string): Promise<void> => {
  userStore.update(state => ({ ...state, isLoading: true, error: null }))
  
  try {
    await confirmSignUp(username, code)
    
    userStore.update(state => ({
      ...state,
      isLoading: false
    }))
    
    // Redirect to login page after successful confirmation
    goto('/auth?mode=login&confirmed=true')
  } catch (error) {
    userStore.update(state => ({
      ...state,
      error: error instanceof Error ? error.message : 'Confirmation failed',
      isLoading: false
    }))
  }
}

/**
 * Initiate the forgot password process
 */
export const forgotPasswordRequest = async (credentials: ForgotPasswordCredentials): Promise<void> => {
  userStore.update(state => ({ ...state, isLoading: true, error: null }))
  
  try {
    await forgotPassword(credentials)
    
    userStore.update(state => ({
      ...state,
      isLoading: false
    }))
    
    // Redirect to reset password page
    goto('/auth?mode=reset&username=' + encodeURIComponent(credentials.username))
  } catch (error) {
    userStore.update(state => ({
      ...state,
      error: error instanceof Error ? error.message : 'Forgot password request failed',
      isLoading: false
    }))
  }
}

/**
 * Reset a user's password
 */
export const resetPasswordConfirm = async (credentials: ResetPasswordCredentials): Promise<void> => {
  userStore.update(state => ({ ...state, isLoading: true, error: null }))
  
  try {
    await resetPassword(credentials)
    
    userStore.update(state => ({
      ...state,
      isLoading: false
    }))
    
    // Redirect to login page after successful password reset
    goto('/auth?mode=login&reset=true')
  } catch (error) {
    userStore.update(state => ({
      ...state,
      error: error instanceof Error ? error.message : 'Password reset failed',
      isLoading: false
    }))
  }
}

/**
 * Sign out the current user
 */
export const logout = (): void => {
  cognitoSignOut()
  
  userStore.update(state => ({
    ...state,
    isAuthenticated: false,
    user: null,
    token: null,
    refreshToken: null
  }))
  
  // Redirect to home page after logout
  goto('/')
}