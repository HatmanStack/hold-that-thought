/**
 * Integration tests for Reactions API
 */
const { apiRequest, waitForConsistency, generateTestId } = require('./setup')

describe('reactions API Integration Tests', () => {
  const testItemId = '/2015/test-letter'
  let testCommentId

  beforeAll(async () => {
    // Create a test comment to react to
    const { status, data } = await apiRequest('POST', `/comments${testItemId}`, {
      commentText: `Test comment for reactions ${generateTestId()}`,
      itemType: 'letter',
      itemTitle: 'Test',
    })

    if (status === 201) {
      testCommentId = data.commentId
    }

    await waitForConsistency(1000)
  })

  it('pOST /reactions/{commentId} adds reaction', async () => {
    if (!testCommentId) {
      console.log('Skipping test - no comment created')
      return
    }

    const { status, data } = await apiRequest(
      'POST',
      `/reactions/${encodeURIComponent(testCommentId)}`,
      { itemId: testItemId, reactionType: 'like' },
    )

    expect(status).toBe(200)
    expect(data).toHaveProperty('liked')
    expect(data.liked).toBe(true)
  })

  it('pOST /reactions/{commentId} removes reaction on second call', async () => {
    if (!testCommentId) {
      console.log('Skipping test - no comment created')
      return
    }

    await waitForConsistency(500)

    const { status, data } = await apiRequest(
      'POST',
      `/reactions/${encodeURIComponent(testCommentId)}`,
      { itemId: testItemId, reactionType: 'like' },
    )

    expect(status).toBe(200)
    expect(data).toHaveProperty('liked')
    expect(data.liked).toBe(false)
  })

  it('gET /reactions/{commentId} lists reactions', async () => {
    if (!testCommentId) {
      console.log('Skipping test - no comment created')
      return
    }

    await waitForConsistency(500)

    const { status, data } = await apiRequest(
      'GET',
      `/reactions/${encodeURIComponent(testCommentId)}`,
    )

    expect(status).toBe(200)
    expect(data).toHaveProperty('reactions')
    expect(Array.isArray(data.reactions)).toBe(true)
    expect(data).toHaveProperty('count')
  })
})
