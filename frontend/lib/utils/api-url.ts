/**
 * API URL utilities for consistent versioned API access
 */
import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'

/**
 * Current API version prefix
 */
export const API_VERSION = '/v1'

/**
 * Get the base API URL with version prefix
 */
export function getApiBaseUrl(): string {
  const base = (PUBLIC_API_GATEWAY_URL || '').replace(/\/+$/, '')
  return `${base}${API_VERSION}`
}

/**
 * Build a full API URL for a given endpoint
 * @param endpoint - The API endpoint (e.g., '/comments/abc123')
 * @returns Full URL with base and version prefix
 */
export function buildApiUrl(endpoint: string): string {
  const base = getApiBaseUrl()
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${base}${path}`
}
