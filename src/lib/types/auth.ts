export interface AuthConfig {
  region: string
  userPoolId: string
  userPoolWebClientId: string
  oauth: {
    domain: string
    scope: string[]
    redirectSignIn: string
    redirectSignOut: string
    responseType: 'code' | 'token'
  }
}

export interface User {
  username: string
  email: string
  sub: string
  email_verified: boolean
  name?: string
  family_name?: string
  given_name?: string
  picture?: string
  // Add any additional user attributes here
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  refreshToken: string | null
  error: string | null
  isLoading: boolean
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface SignupCredentials {
  username: string
  password: string
  email: string
  given_name?: string
  family_name?: string
  // Add any additional signup fields here
}

export interface ResetPasswordCredentials {
  username: string
  code: string
  newPassword: string
}

export interface ForgotPasswordCredentials {
  username: string
}