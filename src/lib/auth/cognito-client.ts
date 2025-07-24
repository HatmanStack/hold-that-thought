import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  type InitiateAuthCommandInput,
  type SignUpCommandInput,
  type ConfirmSignUpCommandInput,
} from '@aws-sdk/client-cognito-identity-provider'
import { cognitoConfig } from './cognito-config'

export class CognitoAuthClient {
  private client: CognitoIdentityProviderClient

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: cognitoConfig.region,
    })
  }

  async signUp(email: string, password: string, attributes: Record<string, string> = {}) {
    const params: SignUpCommandInput = {
      ClientId: cognitoConfig.userPoolWebClientId,
      Username: email,
      Password: password,
      UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
    }

    try {
      const command = new SignUpCommand(params)
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  async confirmSignUp(email: string, confirmationCode: string) {
    const params: ConfirmSignUpCommandInput = {
      ClientId: cognitoConfig.userPoolWebClientId,
      Username: email,
      ConfirmationCode: confirmationCode,
    }

    try {
      const command = new ConfirmSignUpCommand(params)
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  async signIn(email: string, password: string) {
    const params: InitiateAuthCommandInput = {
      ClientId: cognitoConfig.userPoolWebClientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }

    try {
      const command = new InitiateAuthCommand(params)
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  async refreshToken(refreshToken: string) {
    const params: InitiateAuthCommandInput = {
      ClientId: cognitoConfig.userPoolWebClientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    }

    try {
      const command = new InitiateAuthCommand(params)
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  async getCurrentUser(accessToken: string) {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      })
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  async signOut(accessToken: string) {
    try {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken,
      })
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  async forgotPassword(email: string) {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: cognitoConfig.userPoolWebClientId,
        Username: email,
      })
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }

  async confirmForgotPassword(email: string, confirmationCode: string, newPassword: string) {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: cognitoConfig.userPoolWebClientId,
        Username: email,
        ConfirmationCode: confirmationCode,
        Password: newPassword,
      })
      const response = await this.client.send(command)
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error as Error }
    }
  }
}

export const cognitoAuth = new CognitoAuthClient()