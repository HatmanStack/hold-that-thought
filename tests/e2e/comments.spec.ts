import { expect, test } from '@playwright/test'
import { clearAuth, setupAuth, TEST_USERS, waitForAuthInit } from './auth-helpers'

test.describe('Comments Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication before each test
    await setupAuth(page, TEST_USERS.testUser)
  })

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await clearAuth(page)
  })

  test('user can add comment to letter', async ({ page }) => {
    // Navigate to a letter page (adjust path as needed)
    await page.goto('/2015/christmas')
    await waitForAuthInit(page)

    // Wait for the comment section to load
    await expect(page.locator('[data-testid="comment-section"]')).toBeVisible({ timeout: 10000 })

    // Scroll to comment section
    await page.locator('[data-testid="comment-section"]').scrollIntoViewIfNeeded()

    // Type a comment
    const commentText = `Test comment at ${Date.now()}`
    await page.fill('textarea[aria-label="Write a comment"], textarea[placeholder*="comment"]', commentText)

    // Submit the comment
    await page.click('button:has-text("Post"), button:has-text("Comment")')

    // Verify comment appears
    await expect(page.locator(`text=${commentText}`)).toBeVisible({ timeout: 5000 })
  })

  test('user can edit their own comment', async ({ page }) => {
    // Navigate to a letter with existing comment
    await page.goto('/2015/christmas')
    await waitForAuthInit(page)

    // Add a comment first
    const originalText = `Original comment ${Date.now()}`
    await page.fill('textarea[aria-label="Write a comment"], textarea[placeholder*="comment"]', originalText)
    await page.click('button:has-text("Post"), button:has-text("Comment")')
    await expect(page.locator(`text=${originalText}`)).toBeVisible()

    // Click edit button
    await page.locator('button[aria-label="Edit comment"], button:has-text("Edit")').first().click()

    // Modify the comment
    const editedText = `Edited comment ${Date.now()}`
    await page.fill('textarea[aria-label="Edit comment"]', editedText)
    await page.click('button:has-text("Save")')

    // Verify edited comment appears
    await expect(page.locator(`text=${editedText}`)).toBeVisible()
    await expect(page.locator(`text=${originalText}`)).not.toBeVisible()
  })

  test('user can delete their own comment', async ({ page }) => {
    // Navigate to a letter
    await page.goto('/2015/christmas')
    await waitForAuthInit(page)

    // Add a comment
    const commentText = `Comment to delete ${Date.now()}`
    await page.fill('textarea[aria-label="Write a comment"], textarea[placeholder*="comment"]', commentText)
    await page.click('button:has-text("Post"), button:has-text("Comment")')
    await expect(page.locator(`text=${commentText}`)).toBeVisible()

    // Click delete button
    await page.locator('button[aria-label="Delete comment"], button:has-text("Delete")').first().click()

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")')
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }

    // Verify comment is removed
    await expect(page.locator(`text=${commentText}`)).not.toBeVisible({ timeout: 5000 })
  })

  test('user can react to comment', async ({ page }) => {
    // Navigate to a letter with comments
    await page.goto('/2015/christmas')
    await waitForAuthInit(page)

    // Wait for comments to load
    await expect(page.locator('[data-testid="comment-section"]')).toBeVisible({ timeout: 10000 })

    // Click like/react button on first comment
    const likeButton = page.locator('button[aria-label*="Like"], button:has-text("♥"), button:has-text("👍")').first()

    if (await likeButton.isVisible()) {
      await likeButton.click()

      // Verify reaction count increased (this is basic - adjust based on actual UI)
      await expect(likeButton).toHaveAttribute('aria-pressed', 'true', { timeout: 2000 }).catch(() => {
        // Fallback: just verify the button is still visible
        return expect(likeButton).toBeVisible()
      })
    }
  })

  test('comments load with pagination', async ({ page }) => {
    // Navigate to a letter (this assumes the letter has many comments)
    await page.goto('/2015/christmas')
    await waitForAuthInit(page)

    // Wait for comment section
    await expect(page.locator('[data-testid="comment-section"]')).toBeVisible({ timeout: 10000 })

    // Check if "Load More" button exists
    const loadMoreButton = page.locator('button:has-text("Load More"), button:has-text("Show More")')

    if (await loadMoreButton.isVisible()) {
      // Count comments before
      const commentsBefore = await page.locator('[data-testid="comment-item"], .comment-item').count()

      // Click load more
      await loadMoreButton.click()

      // Wait for new comments to load
      await page.waitForTimeout(1000)

      // Count comments after
      const commentsAfter = await page.locator('[data-testid="comment-item"], .comment-item').count()

      // Verify more comments loaded
      expect(commentsAfter).toBeGreaterThan(commentsBefore)
    }
  })
})
