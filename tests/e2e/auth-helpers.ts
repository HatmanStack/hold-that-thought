import type { Page } from '@playwright/test'

/**
 * Test user credentials for E2E testing
 * These should match users in your test Cognito pool
 */
export const TEST_USERS = {
  testUser: {
    email: 'test@example.com',
    sub: 'test-user-123',
    email_verified: true,
  },
  adminUser: {
    email: 'admin@example.com',
    sub: 'admin-user-456',
    email_verified: true,
  },
}

/**
 * Set up authentication state in localStorage
 * This bypasses the actual OAuth flow for testing
 */
export async function setupAuth(page: Page, user: typeof TEST_USERS.testUser) {
  const tokens = {
    accessToken: 'test-access-token',
    idToken: 'test-id-token',
    refreshToken: 'test-refresh-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
  }

  await page.addInitScript(({ user, tokens }) => {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens))
    localStorage.setItem('auth_user', JSON.stringify(user))
    localStorage.removeItem('auth_signed_out')
  }, { user, tokens })
}

/**
 * Clear authentication state
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.clear()
  })
}

/**
 * Wait for page to be fully loaded and auth state initialized
 */
export async function waitForAuthInit(page: Page) {
  // Wait for the page to finish loading and auth store to initialize
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500) // Give auth store time to initialize
}
