/**
 * Integration tests for Messages API
 */
const { apiRequest, waitForConsistency, generateTestId } = require('./setup');

describe('Messages API Integration Tests', () => {
  let conversationId;

  test('POST /messages/conversations creates 1-on-1 conversation', async () => {
    const testUserId = process.env.TEST_USER_2_ID || 'test-user-2';

    const { status, data } = await apiRequest('POST', '/messages/conversations', {
      participantIds: [testUserId],
      messageText: `Test message ${generateTestId()}`
    });

    expect(status).toBe(201);
    expect(data).toHaveProperty('conversationId');
    expect(data).toHaveProperty('conversationType');
    expect(data.conversationType).toBe('direct');

    conversationId = data.conversationId;
  });

  test('POST /messages/conversations/{conversationId} sends message', async () => {
    if (!conversationId) {
      console.log('Skipping test - no conversation created');
      return;
    }

    await waitForConsistency(1000);

    const messageText = `Integration test message ${generateTestId()}`;

    const { status, data } = await apiRequest(
      'POST',
      `/messages/conversations/${conversationId}`,
      { messageText }
    );

    expect(status).toBe(201);
    expect(data).toHaveProperty('messageText');
    expect(data.messageText).toBe(messageText);
    expect(data.conversationId).toBe(conversationId);
  });

  test('POST /messages/conversations/{conversationId} rejects text longer than 5000 chars', async () => {
    if (!conversationId) {
      console.log('Skipping test - no conversation created');
      return;
    }

    const longText = 'a'.repeat(5001);

    const { status, data } = await apiRequest(
      'POST',
      `/messages/conversations/${conversationId}`,
      { messageText: longText }
    );

    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('5000 characters');
  });

  test('GET /messages/conversations lists conversations', async () => {
    await waitForConsistency(1000);

    const { status, data } = await apiRequest('GET', '/messages/conversations');

    expect(status).toBe(200);
    expect(data).toHaveProperty('conversations');
    expect(Array.isArray(data.conversations)).toBe(true);
  });

  test('GET /messages/conversations/{conversationId} lists messages', async () => {
    if (!conversationId) {
      console.log('Skipping test - no conversation created');
      return;
    }

    await waitForConsistency(1000);

    const { status, data } = await apiRequest(
      'GET',
      `/messages/conversations/${conversationId}`
    );

    expect(status).toBe(200);
    expect(data).toHaveProperty('messages');
    expect(Array.isArray(data.messages)).toBe(true);
  });

  test('PUT /messages/conversations/{conversationId}/read marks as read', async () => {
    if (!conversationId) {
      console.log('Skipping test - no conversation created');
      return;
    }

    await waitForConsistency(500);

    const { status, data } = await apiRequest(
      'PUT',
      `/messages/conversations/${conversationId}/read`
    );

    expect(status).toBe(200);
    expect(data).toHaveProperty('message');
  });

  test('POST /messages/upload generates presigned URL', async () => {
    const { status, data } = await apiRequest('POST', '/messages/upload', {
      fileName: 'test.jpg',
      contentType: 'image/jpeg'
    });

    expect(status).toBe(200);
    expect(data).toHaveProperty('uploadUrl');
    expect(data).toHaveProperty('s3Key');
    expect(data.s3Key).toContain('messages/attachments/');
  });
});
