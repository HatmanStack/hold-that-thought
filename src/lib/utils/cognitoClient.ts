import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession
} from 'amazon-cognito-identity-js'
import { auth } from '$lib/config/auth'
import type { 
  LoginCredentials, 
  SignupCredentials, 
  ResetPasswordCredentials,
  ForgotPasswordCredentials,
  User
} from '$lib/types/auth'

// Initialize the Cognito Identity Provider client
export const cognitoClient = new CognitoIdentityProviderClient({
  region: auth.region
})

// Initialize the Cognito User Pool
const userPool = new CognitoUserPool({
  UserPoolId: auth.userPoolId,
  ClientId: auth.userPoolWebClientId
})

/**
 * Sign in a user with their username and password
 */
export const signIn = async (credentials: LoginCredentials): Promise<CognitoUserSession> => {
  const { username, password } = credentials
  
  const authenticationDetails = new AuthenticationDetails({
    Username: username,
    Password: password
  })
  
  const cognitoUser = new CognitoUser({
    Username: username,
    Pool: userPool
  })
  
  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        resolve(session)
      },
      onFailure: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * Sign up a new user
 */
export const signUp = async (credentials: SignupCredentials): Promise<any> => {
  const { username, password, email, given_name, family_name } = credentials
  
  const attributeList = [
    new CognitoUserAttribute({ Name: 'email', Value: email })
  ]
  
  if (given_name) {
    attributeList.push(new CognitoUserAttribute({ Name: 'given_name', Value: given_name }))
  }
  
  if (family_name) {
    attributeList.push(new CognitoUserAttribute({ Name: 'family_name', Value: family_name }))
  }
  
  return new Promise((resolve, reject) => {
    userPool.signUp(username, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Confirm a user's registration with the verification code
 */
export const confirmSignUp = async (username: string, code: string): Promise<any> => {
  const cognitoUser = new CognitoUser({
    Username: username,
    Pool: userPool
  })
  
  return new Promise((resolve, reject) => {
    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Resend the verification code to confirm registration
 */
export const resendConfirmationCode = async (username: string): Promise<any> => {
  const cognitoUser = new CognitoUser({
    Username: username,
    Pool: userPool
  })
  
  return new Promise((resolve, reject) => {
    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Initiate the forgot password flow
 */
export const forgotPassword = async (credentials: ForgotPasswordCredentials): Promise<any> => {
  const { username } = credentials
  
  const cognitoUser = new CognitoUser({
    Username: username,
    Pool: userPool
  })
  
  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess: (data) => {
        resolve(data)
      },
      onFailure: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * Complete the forgot password flow by setting a new password
 */
export const resetPassword = async (credentials: ResetPasswordCredentials): Promise<any> => {
  const { username, code, newPassword } = credentials
  
  const cognitoUser = new CognitoUser({
    Username: username,
    Pool: userPool
  })
  
  return new Promise((resolve, reject) => {
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => {
        resolve('Password reset successful')
      },
      onFailure: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * Sign out the current user
 */
export const signOut = (): void => {
  const currentUser = userPool.getCurrentUser()
  if (currentUser) {
    currentUser.signOut()
  }
}

/**
 * Get the current authenticated user
 */
export const getCurrentUser = (): Promise<User | null> => {
  const currentUser = userPool.getCurrentUser()
  
  if (!currentUser) {
    return Promise.resolve(null)
  }
  
  return new Promise((resolve, reject) => {
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err)
        return
      }
      
      if (!session?.isValid()) {
        resolve(null)
        return
      }
      
      currentUser.getUserAttributes((err, attributes) => {
        if (err) {
          reject(err)
          return
        }
        
        const user: Partial<User> = {
          username: currentUser.getUsername()
        }
        
        if (attributes) {
          attributes.forEach(attr => {
            switch (attr.getName()) {
              case 'email':
                user.email = attr.getValue()
                break
              case 'sub':
                user.sub = attr.getValue()
                break
              case 'email_verified':
                user.email_verified = attr.getValue() === 'true'
                break
              case 'name':
                user.name = attr.getValue()
                break
              case 'family_name':
                user.family_name = attr.getValue()
                break
              case 'given_name':
                user.given_name = attr.getValue()
                break
              case 'picture':
                user.picture = attr.getValue()
                break
              // Add any additional attributes here
            }
          })
        }
        
        resolve(user as User)
      })
    })
  })
}

/**
 * Get the current session tokens
 */
export const getSession = async (): Promise<CognitoUserSession | null> => {
  const currentUser = userPool.getCurrentUser()
  
  if (!currentUser) {
    return null
  }
  
  return new Promise((resolve, reject) => {
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err)
        return
      }
      
      resolve(session)
    })
  })
}

/**
 * Check if the current user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const session = await getSession()
    return !!session?.isValid()
  } catch (error) {
    return false
  }
}