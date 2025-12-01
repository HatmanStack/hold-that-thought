import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  type InitiateAuthCommandInput,
} from '@aws-sdk/client-cognito-identity-provider'
import { cognitoConfig } from './cognito-config'

export class CognitoAuthClient {
  private client: CognitoIdentityProviderClient

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: cognitoConfig.region,
    })
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
      return { success: false, error: error as Error }
    }
  }
}

export const cognitoAuth = new CognitoAuthClient()
