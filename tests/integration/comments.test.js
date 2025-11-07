/**
 * Integration tests for Comments API
 */
const { apiRequest, waitForConsistency, generateTestId } = require('./setup');

describe('Comments API Integration Tests', () => {
  const testItemId = '/2015/christmas-test';
  let createdCommentId;

  test('POST /comments/{itemId} creates new comment', async () => {
    const commentText = `Test comment ${generateTestId()}`;

    const { status, data } = await apiRequest('POST', `/comments${testItemId}`, {
      commentText,
      itemType: 'letter',
      itemTitle: 'Test Letter'
    });

    expect(status).toBe(201);
    expect(data).toHaveProperty('commentId');
    expect(data).toHaveProperty('commentText');
    expect(data.commentText).toBe(commentText);
    expect(data.isDeleted).toBe(false);

    createdCommentId = data.commentId;
  });

  test('POST /comments/{itemId} sanitizes HTML', async () => {
    const dirtyText = '<script>alert("xss")</script>Hello <b>world</b>!';

    const { status, data } = await apiRequest('POST', `/comments${testItemId}`, {
      commentText: dirtyText,
      itemType: 'letter',
      itemTitle: 'Test Letter'
    });

    expect(status).toBe(201);
    expect(data.commentText).toBe('Hello world!');
    expect(data.commentText).not.toContain('<script>');
    expect(data.commentText).not.toContain('<b>');
  });

  test('POST /comments/{itemId} rejects text longer than 2000 chars', async () => {
    const longText = 'a'.repeat(2001);

    const { status, data } = await apiRequest('POST', `/comments${testItemId}`, {
      commentText: longText
    });

    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('2000 characters');
  });

  test('GET /comments/{itemId} lists comments', async () => {
    await waitForConsistency(2000); // Wait for eventual consistency

    const { status, data } = await apiRequest('GET', `/comments${testItemId}`);

    expect(status).toBe(200);
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });

  test('PUT /comments/{itemId}/{commentId} edits comment', async () => {
    if (!createdCommentId) {
      console.log('Skipping edit test - no comment created');
      return;
    }

    const updatedText = `Updated comment ${generateTestId()}`;

    await waitForConsistency(1000);

    const { status, data } = await apiRequest(
      'PUT',
      `/comments${testItemId}/${encodeURIComponent(createdCommentId)}`,
      { commentText: updatedText }
    );

    expect(status).toBe(200);
    expect(data.commentText).toBe(updatedText);
    expect(data.isEdited).toBe(true);
    expect(data.editHistory).toBeDefined();
  });

  test('DELETE /comments/{itemId}/{commentId} soft-deletes comment', async () => {
    if (!createdCommentId) {
      console.log('Skipping delete test - no comment created');
      return;
    }

    await waitForConsistency(1000);

    const { status } = await apiRequest(
      'DELETE',
      `/comments${testItemId}/${encodeURIComponent(createdCommentId)}`
    );

    expect(status).toBe(200);
  });
});
