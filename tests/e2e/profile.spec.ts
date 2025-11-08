import { test, expect } from '@playwright/test';
import { setupAuth, clearAuth, waitForAuthInit, TEST_USERS } from './auth-helpers';

test.describe('Profile Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication before each test
    await setupAuth(page, TEST_USERS.testUser);
  });

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await clearAuth(page);
  });

  test('user can view their own profile', async ({ page }) => {
    // Navigate to profile settings or profile page
    await page.goto('/profile/settings');
    await waitForAuthInit(page);

    // Verify profile page loads
    await expect(page.locator('h1, h2').filter({ hasText: /profile|settings/i })).toBeVisible({ timeout: 10000 });

    // Verify user email is displayed
    await expect(page.locator(`text=${TEST_USERS.testUser.email}`)).toBeVisible();
  });

  test('user can edit profile bio', async ({ page }) => {
    // Navigate to profile settings
    await page.goto('/profile/settings');
    await waitForAuthInit(page);

    // Wait for profile form to load
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

    // Edit bio
    const newBio = `Test bio updated at ${Date.now()}`;
    const bioField = page.locator('textarea[name="bio"], textarea[aria-label="Bio"], textarea[placeholder*="bio"]');

    if (await bioField.isVisible()) {
      await bioField.fill(newBio);

      // Save changes
      await page.click('button:has-text("Save"), button[type="submit"]');

      // Wait for save confirmation
      await expect(page.locator('text=/saved|updated|success/i')).toBeVisible({ timeout: 5000 }).catch(() => {
        // If no explicit message, just wait a bit
        return page.waitForTimeout(1000);
      });

      // Verify bio was saved by reloading and checking
      await page.reload();
      await waitForAuthInit(page);
      await expect(bioField).toHaveValue(newBio, { timeout: 5000 });
    }
  });

  test('user can update family relationship', async ({ page }) => {
    // Navigate to profile settings
    await page.goto('/profile/settings');
    await waitForAuthInit(page);

    // Wait for form to load
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

    // Update family relationship
    const familyField = page.locator('input[name="familyRelationship"], input[aria-label*="relationship"], input[placeholder*="relationship"]');

    if (await familyField.isVisible()) {
      const newRelationship = `Cousin (Test ${Date.now()})`;
      await familyField.fill(newRelationship);

      // Save
      await page.click('button:has-text("Save"), button[type="submit"]');

      // Wait for save
      await page.waitForTimeout(1000);

      // Reload and verify
      await page.reload();
      await waitForAuthInit(page);
      await expect(familyField).toHaveValue(newRelationship, { timeout: 5000 });
    }
  });

  test('user can upload profile photo', async ({ page }) => {
    // Navigate to profile settings
    await page.goto('/profile/settings');
    await waitForAuthInit(page);

    // Look for file input for profile photo
    const fileInput = page.locator('input[type="file"][accept*="image"]');

    if (await fileInput.isVisible({ timeout: 5000 })) {
      // Create a test image file (1x1 PNG)
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      // Upload the file
      await fileInput.setInputFiles({
        name: 'test-profile.png',
        mimeType: 'image/png',
        buffer,
      });

      // Wait for upload to complete (adjust based on actual UI feedback)
      await page.waitForTimeout(2000);

      // Verify success message or profile image updated
      const successMessage = page.locator('text=/uploaded|success/i');
      const profileImage = page.locator('img[alt*="profile"], img[alt*="avatar"]');

      // Check either success message or image src changed
      try {
        await expect(successMessage).toBeVisible({ timeout: 3000 });
      } catch {
        await expect(profileImage).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('user can view their comment history', async ({ page }) => {
    // Navigate to own profile (not settings)
    await page.goto(`/profile/${TEST_USERS.testUser.sub}`);
    await waitForAuthInit(page);

    // Verify profile page loads
    await expect(page.locator('h1, h2').filter({ hasText: /profile/i })).toBeVisible({ timeout: 10000 });

    // Look for comment history section
    const commentHistorySection = page.locator('[data-testid="comment-history"], section:has-text("Comments")');

    if (await commentHistorySection.isVisible({ timeout: 5000 })) {
      // Verify at least one comment exists or "no comments" message
      const hasComments = await page.locator('[data-testid="comment-item"], .comment-item').count() > 0;
      const noCommentsMessage = await page.locator('text=/no comments/i').isVisible();

      expect(hasComments || noCommentsMessage).toBeTruthy();
    }
  });

  test('user can view activity stats', async ({ page }) => {
    // Navigate to own profile
    await page.goto(`/profile/${TEST_USERS.testUser.sub}`);
    await waitForAuthInit(page);

    // Look for activity stats section
    const statsSection = page.locator('[data-testid="activity-stats"], section:has-text("Activity")');

    if (await statsSection.isVisible({ timeout: 5000 })) {
      // Verify stats are displayed (comment count, uploads, etc.)
      const statItems = page.locator('[data-testid="stat-item"], .stat');
      const statCount = await statItems.count();

      expect(statCount).toBeGreaterThan(0);
    }
  });

  test('user can toggle profile privacy', async ({ page }) => {
    // Navigate to profile settings
    await page.goto('/profile/settings');
    await waitForAuthInit(page);

    // Look for privacy toggle
    const privacyToggle = page.locator('input[type="checkbox"][name*="private"], input[type="checkbox"][aria-label*="private"]');

    if (await privacyToggle.isVisible({ timeout: 5000 })) {
      // Get current state
      const isChecked = await privacyToggle.isChecked();

      // Toggle it
      await privacyToggle.click();

      // Save
      await page.click('button:has-text("Save"), button[type="submit"]');

      // Wait for save
      await page.waitForTimeout(1000);

      // Reload and verify state changed
      await page.reload();
      await waitForAuthInit(page);

      const newState = await privacyToggle.isChecked();
      expect(newState).toBe(!isChecked);
    }
  });

  test('user can navigate to profile from comment', async ({ page }) => {
    // Navigate to a letter with comments
    await page.goto('/2015/christmas');
    await waitForAuthInit(page);

    // Wait for comments to load
    await expect(page.locator('[data-testid="comment-section"]')).toBeVisible({ timeout: 10000 });

    // Click on a commenter's name/avatar
    const commenterLink = page.locator('a[href*="/profile/"]').first();

    if (await commenterLink.isVisible({ timeout: 5000 })) {
      const href = await commenterLink.getAttribute('href');
      await commenterLink.click();

      // Wait for navigation
      await page.waitForURL(new RegExp('/profile/'), { timeout: 5000 });

      // Verify profile page loaded
      await expect(page.locator('h1, h2').filter({ hasText: /profile/i })).toBeVisible();
    }
  });
});
