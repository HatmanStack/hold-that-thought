/**
 * Integration test setup
 * Handles Cognito authentication and test data management
 */
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');

const API_URL = process.env.API_URL || 'https://api.example.com/prod';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

let cachedToken = null;

/**
 * Get JWT access token from Cognito
 */
async function getAuthToken() {
  if (cachedToken) {
    return cachedToken;
  }

  if (!COGNITO_CLIENT_ID) {
    throw new Error('COGNITO_CLIENT_ID environment variable not set');
  }

  const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });

  try {
    const response = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: TEST_USER_EMAIL,
        PASSWORD: TEST_USER_PASSWORD
      }
    }));

    cachedToken = response.AuthenticationResult.AccessToken;
    return cachedToken;
  } catch (error) {
    console.error('Failed to get auth token:', error.message);
    throw error;
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest(method, path, body = null) {
  const token = await getAuthToken();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);

  return {
    status: response.status,
    data: response.status !== 204 ? await response.json() : null
  };
}

/**
 * Wait for eventual consistency
 */
async function waitForConsistency(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique test ID
 */
function generateTestId() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

module.exports = {
  API_URL,
  getAuthToken,
  apiRequest,
  waitForConsistency,
  generateTestId
};
