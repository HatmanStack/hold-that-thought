import { authService } from './auth-service'
import { cognitoConfig } from './cognito-config'

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
  requireAuth?: boolean
}

export class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = cognitoConfig.apiGatewayUrl
  }

  async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      requireAuth = true,
    } = options

    const url = `${this.baseUrl}${endpoint}`

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    }

    // Add authorization header if required
    if (requireAuth) {
      const accessToken = await authService.getValidAccessToken()
      if (!accessToken) {
        throw new Error('No valid access token available')
      }
      requestHeaders.Authorization = `Bearer ${accessToken}`
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    }

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorMessage
        }
        catch {
          // If not JSON, use the text as is
          if (errorText) {
            errorMessage = errorText
          }
        }

        throw new Error(errorMessage)
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T
      }

      return await response.json()
    }
    catch (error) {
      console.error(`API request failed for ${method} ${url}:`, error)
      throw error
    }
  }

  // Convenience methods
  async get<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  }

  async put<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  }

  async delete<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  async patch<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body })
  }
}

export const apiClient = new ApiClient()
