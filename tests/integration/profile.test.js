/**
 * Integration tests for Profile API
 */
const { apiRequest, waitForConsistency, generateTestId } = require('./setup');

describe('Profile API Integration Tests', () => {
  test('GET /profile/{userId} returns user profile', async () => {
    const userId = process.env.TEST_USER_ID || 'test-user-123';

    const { status, data } = await apiRequest('GET', `/profile/${userId}`);

    expect(status).toBe(200);
    expect(data).toHaveProperty('userId');
    expect(data.userId).toBe(userId);
  });

  test('PUT /profile updates own profile', async () => {
    const testBio = `Integration test bio ${generateTestId()}`;

    const { status, data } = await apiRequest('PUT', '/profile', {
      displayName: 'Test User',
      bio: testBio,
      familyRelationship: 'Integration Test'
    });

    expect(status).toBe(200);
    expect(data).toHaveProperty('bio');
    expect(data.bio).toBe(testBio);
  });

  test('PUT /profile rejects bio longer than 500 chars', async () => {
    const longBio = 'a'.repeat(501);

    const { status, data } = await apiRequest('PUT', '/profile', {
      bio: longBio
    });

    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('500 characters');
  });

  test('GET /profile/{userId}/comments returns comment history', async () => {
    const userId = process.env.TEST_USER_ID || 'test-user-123';

    const { status, data } = await apiRequest('GET', `/profile/${userId}/comments`);

    expect(status).toBe(200);
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });

  test('GET /profile/{userId} returns 403 for private profile (non-owner)', async () => {
    const privateUserId = 'private-user-test';

    const { status, data } = await apiRequest('GET', `/profile/${privateUserId}`);

    // Will be 403 if profile is private, or 404 if doesn't exist
    expect([403, 404]).toContain(status);
  });
});
