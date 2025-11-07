# Phase 2: Comments System

## Phase Goal

Build the complete frontend commenting interface and integrate it into letter pages and gallery items. This phase focuses on creating reusable Svelte components for commenting, connecting them to the backend APIs from Phase 1, and enabling users to comment on, react to, and moderate discussions on family letters and media.

**Success Criteria:**
- Comment section visible on all letter pages
- Users can create, edit, delete their own comments
- Users can like/unlike comments
- Admins can delete any comment
- Email notifications sent for new comments and reactions
- Comments load with pagination ("Load More" button)
- UI is mobile-responsive

**Estimated Tokens: ~85,000**

---

## Prerequisites

Before starting this phase:

- [ ] Phase 1 complete (all backend APIs functional)
- [ ] Can create comments via curl/Postman (verify backend works)
- [ ] SvelteKit dev environment running (`pnpm dev`)
- [ ] Familiar with Svelte component patterns
- [ ] Understand existing auth store (`src/lib/stores/auth.ts`)

---

## Task 1: Create Comment Service API Client

**Goal:** Build TypeScript service layer to interact with comments backend APIs.

**Files to Create:**
- `src/lib/services/commentService.ts` - Comment API client
- `src/lib/services/reactionService.ts` - Reaction API client
- `src/lib/types/comment.ts` - TypeScript interfaces

**Implementation Steps:**

1. Define TypeScript interfaces for Comment, Reaction types
2. Implement API client functions:
   - `getComments(itemId, limit, lastKey)` - Fetch comments with pagination
   - `createComment(itemId, text, itemType, itemTitle)` - Post new comment
   - `updateComment(itemId, commentId, text)` - Edit comment
   - `deleteComment(itemId, commentId)` - Soft delete comment
   - `toggleReaction(commentId)` - Add/remove reaction
   - `getReactions(commentId)` - Get all reactions
3. Use existing auth store to get JWT token
4. Handle API errors gracefully (return error objects, don't throw)
5. Add request/response logging for debugging

**Architecture Guidance:**

- **API Base URL:** Read from environment variable `VITE_API_URL`
- **Error Handling:** Return `{ success: false, error: 'message' }` instead of throwing
- **Token Refresh:** Auth store handles token refresh automatically before expiry
- **Type Safety:** Use strict TypeScript types, no `any`

Example interface:
```typescript
export interface Comment {
  itemId: string;
  commentId: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  commentText: string;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  editHistory?: Array<{ text: string; timestamp: string }>;
  reactionCount: number;
  isDeleted: boolean;
  itemType: 'letter' | 'media';
  itemTitle: string;
}
```

**Verification Checklist:**

- [ ] TypeScript interfaces defined for Comment, Reaction
- [ ] All API functions implemented and typed
- [ ] Functions use auth store for JWT token
- [ ] Error responses handled gracefully
- [ ] API base URL configurable via env var
- [ ] No TypeScript errors: `pnpm check`

**Testing Instructions:**

Create manual test file to verify API calls:
```typescript
// src/lib/services/__tests__/commentService.test.ts
import { getComments, createComment } from '../commentService';

// Manual test (requires backend running)
async function testCommentService() {
  const result = await getComments('/2015/christmas', 50);
  console.log('Comments:', result);
  
  const created = await createComment('/2015/christmas', 'Test comment', 'letter', 'Christmas 2015');
  console.log('Created:', created);
}
```

**Commit Message Template:**
```
feat(comments): create comment and reaction API service clients

- Define TypeScript interfaces for Comment and Reaction
- Implement getComments, createComment, updateComment, deleteComment
- Implement toggleReaction and getReactions
- Use auth store for JWT token management
- Add error handling for API failures

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 2: Create CommentForm Component

**Goal:** Build Svelte component for creating new comments with character counter and validation.

**Files to Create:**
- `src/lib/components/comments/CommentForm.svelte` - New comment input form

**Implementation Steps:**

1. Create Svelte component with textarea and submit button
2. Add character counter (max 2000 characters)
3. Disable submit button if empty or over limit
4. Show loading state while submitting
5. Call `createComment` service on submit
6. Emit `commentCreated` event on success
7. Clear textarea after successful submit
8. Show error message if submission fails
9. Style with TailwindCSS + DaisyUI

**Architecture Guidance:**

- **Component Props:**
  - `itemId: string` - Letter path or media S3 key
  - `itemType: 'letter' | 'media'`
  - `itemTitle: string`

- **Component Events:**
  - `commentCreated` - Emitted when comment successfully created, passes new Comment object

- **Accessibility:**
  - Label textarea with `<label for="comment-input">`
  - Show live character count with `aria-live="polite"`
  - Disable submit button with `disabled` attribute and visual styling

**Verification Checklist:**

- [ ] Textarea resizes automatically (use `textarea` element, not `input`)
- [ ] Character counter displays: "1850/2000" format
- [ ] Submit button disabled if text empty or > 2000 chars
- [ ] Loading spinner shows while submitting
- [ ] Success: Emits `commentCreated` event and clears textarea
- [ ] Error: Shows error message above form
- [ ] Mobile-responsive (full width on small screens)
- [ ] Accessible (keyboard navigation, ARIA labels)

**Testing Instructions:**

Create test page:
```svelte
<!-- src/routes/test-comment-form/+page.svelte -->
<script>
  import CommentForm from '$lib/components/comments/CommentForm.svelte';
  
  function handleCommentCreated(event) {
    console.log('Comment created:', event.detail);
  }
</script>

<CommentForm 
  itemId="/2015/christmas"
  itemType="letter"
  itemTitle="Christmas Letter 2015"
  on:commentCreated={handleCommentCreated}
/>
```

Test cases:
- Type comment and submit → verify API called
- Type 2001 characters → verify submit disabled
- Submit empty → verify submit disabled
- Submit successfully → verify textarea cleared

**Commit Message Template:**
```
feat(comments): create CommentForm component

- Add textarea with auto-resize
- Implement character counter (max 2000)
- Add submit button with loading state
- Call createComment API on submit
- Emit commentCreated event on success
- Style with TailwindCSS + DaisyUI

Estimated tokens: ~6000
```

**Estimated Tokens: ~6000**

---

## Task 3: Create Comment Display Component

**Goal:** Build Svelte component to display individual comment with edit, delete, and reaction buttons.

**Files to Create:**
- `src/lib/components/comments/Comment.svelte` - Individual comment display

**Implementation Steps:**

1. Create component to display comment data
2. Show user avatar (or default icon), name, timestamp
3. Show comment text (preserve line breaks with `white-space: pre-wrap`)
4. If edited, show "(edited)" badge with tooltip
5. If own comment, show edit and delete buttons
6. If admin, show delete button on all comments
7. Show reaction button with count (heart icon)
8. Implement inline editing: Click edit → textarea appears → save/cancel
9. Implement delete confirmation modal
10. Handle reaction toggle (optimistic UI update)

**Architecture Guidance:**

- **Component Props:**
  - `comment: Comment` - Comment object
  - `currentUserId: string` - For ownership check
  - `isAdmin: boolean` - For moderation

- **Component Events:**
  - `commentUpdated` - Emitted after edit saved
  - `commentDeleted` - Emitted after delete confirmed

- **Optimistic UI:** When toggling reaction, immediately update UI (increment/decrement count), then call API. Revert if API fails.

- **Time Formatting:** Use library like `date-fns` or built-in `Intl.RelativeTimeFormat` for "2 hours ago" format

**Verification Checklist:**

- [ ] Displays user name, avatar, timestamp, text
- [ ] Shows "(edited)" badge if `isEdited: true`
- [ ] Edit button visible only for own comments
- [ ] Delete button visible for own comments + admin
- [ ] Inline editing works (click edit → textarea → save/cancel)
- [ ] Delete shows confirmation modal ("Are you sure?")
- [ ] Reaction button toggles on/off (filled heart if liked)
- [ ] Reaction count updates optimistically
- [ ] Timestamps formatted as relative time ("2 hours ago")

**Testing Instructions:**

Create test page with mock comment:
```svelte
<script>
  import Comment from '$lib/components/comments/Comment.svelte';
  
  const mockComment = {
    itemId: '/2015/christmas',
    commentId: '2025-01-15T10:00:00.000Z#abc',
    userId: 'user-123',
    userName: 'John Doe',
    userPhotoUrl: null,
    commentText: 'Great letter!\n\nLoved the photos.',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    isEdited: false,
    reactionCount: 5,
    isDeleted: false,
    itemType: 'letter',
    itemTitle: 'Christmas 2015'
  };
</script>

<Comment 
  comment={mockComment} 
  currentUserId="user-123" 
  isAdmin={false}
/>
```

Test cases:
- Click edit → verify textarea appears
- Edit and save → verify `commentUpdated` event
- Click delete → verify confirmation modal
- Confirm delete → verify `commentDeleted` event
- Click reaction → verify optimistic UI update

**Commit Message Template:**
```
feat(comments): create Comment display component

- Display user avatar, name, timestamp, comment text
- Add "(edited)" badge for edited comments
- Implement inline editing with save/cancel
- Add delete confirmation modal
- Implement reaction toggle with optimistic UI
- Format timestamps as relative time
- Style with TailwindCSS + DaisyUI

Estimated tokens: ~10000
```

**Estimated Tokens: ~10000**

---

## Task 4: Create CommentSection Container Component

**Goal:** Build container component that combines CommentForm and list of Comments with pagination.

**Files to Create:**
- `src/lib/components/comments/CommentSection.svelte` - Main comment UI container

**Implementation Steps:**

1. Create container component with CommentForm at top
2. Display list of Comment components below
3. Fetch comments on component mount (`onMount`)
4. Handle pagination: "Load More" button if `lastEvaluatedKey` exists
5. Listen to `commentCreated` event and prepend new comment to list (optimistic)
6. Listen to `commentUpdated` and update comment in list
7. Listen to `commentDeleted` and remove comment from list
8. Show loading skeleton while fetching
9. Show empty state if no comments
10. Sort comments by createdAt (oldest first, chronological)

**Architecture Guidance:**

- **Component Props:**
  - `itemId: string`
  - `itemType: 'letter' | 'media'`
  - `itemTitle: string`

- **State Management:**
  - `comments: Comment[] = []` - List of comments
  - `loading: boolean = true` - Initial load state
  - `loadingMore: boolean = false` - Pagination load state
  - `lastKey: string | null` - For pagination

- **Optimistic Updates:** When new comment created, add to `comments` array immediately. If API fails, remove it and show error.

**Verification Checklist:**

- [ ] Fetches comments on mount
- [ ] Displays CommentForm at top
- [ ] Lists all comments in chronological order
- [ ] "Load More" button appears if more comments available
- [ ] Clicking "Load More" fetches next page
- [ ] New comments appear immediately (optimistic)
- [ ] Edited comments update in place
- [ ] Deleted comments removed from list
- [ ] Shows loading skeleton on initial load
- [ ] Shows "No comments yet" if empty
- [ ] Mobile-responsive (stacks vertically on small screens)

**Testing Instructions:**

Integrate into test letter page:
```svelte
<!-- src/routes/test-comment-section/+page.svelte -->
<script>
  import CommentSection from '$lib/components/comments/CommentSection.svelte';
</script>

<h1>Test Letter</h1>
<p>Letter content goes here...</p>

<CommentSection 
  itemId="/2015/christmas"
  itemType="letter"
  itemTitle="Christmas Letter 2015"
/>
```

Test cases:
- Load page → verify comments fetched
- Add comment → verify appears immediately
- Edit comment → verify updates in place
- Delete comment → verify removed from list
- If 50+ comments → verify "Load More" appears
- Click "Load More" → verify next page loads

**Commit Message Template:**
```
feat(comments): create CommentSection container component

- Combine CommentForm and Comment list
- Fetch comments on mount with pagination
- Implement "Load More" button for pagination
- Handle optimistic updates for create/edit/delete
- Add loading skeleton and empty state
- Sort comments chronologically (oldest first)
- Style with TailwindCSS + DaisyUI

Estimated tokens: ~12000
```

**Estimated Tokens: ~12000**

---

## Task 5: Integrate CommentSection into Letter Pages

**Goal:** Add CommentSection component to all letter pages (/{year}/{slug}/).

**Files to Modify:**
- `src/routes/[year]/[slug]/+page.svelte` - Letter page template (or layout)

**Prerequisites:**
- Task 4 complete (CommentSection component ready)

**Implementation Steps:**

1. Locate letter page template (may be in `+page.svelte` or layout file)
2. Import CommentSection component
3. Add section at bottom of letter content (after letter text)
4. Pass itemId (letter path), itemType ('letter'), itemTitle (from frontmatter)
5. Style section with visual separator (horizontal rule or background)
6. Test on multiple letter pages

**Architecture Guidance:**

- **itemId:** Use letter path from URL (e.g., `/2015/christmas-letter`)
- **itemTitle:** Extract from frontmatter (`$page.data.title` or similar)
- **Styling:** Add visual separation between letter and comments (e.g., border-top, padding)

**Verification Checklist:**

- [ ] CommentSection appears on all letter pages
- [ ] itemId matches letter URL path
- [ ] itemTitle displays correctly in comments
- [ ] Comments persist across page refreshes
- [ ] No duplicate comment sections
- [ ] Styling matches site design

**Testing Instructions:**

- Navigate to multiple letter pages: `/2015/christmas`, `/2016/new-year`, etc.
- Verify CommentSection appears on each
- Add comment on one page → refresh → verify comment still there
- Check console for errors

**Commit Message Template:**
```
feat(comments): integrate CommentSection into letter pages

- Add CommentSection component to letter page template
- Pass letter path as itemId
- Extract itemTitle from frontmatter
- Add visual separator between content and comments

Estimated tokens: ~4000
```

**Estimated Tokens: ~4000**

---

## Task 6: Integrate CommentSection into Gallery Pages

**Goal:** Add CommentSection to media item detail views in gallery.

**Files to Modify:**
- Gallery component that shows full media item (identify file with Task exploration)

**Prerequisites:**
- Task 4 complete (CommentSection component ready)

**Implementation Steps:**

1. Explore gallery code to find media detail view component
2. Import CommentSection
3. Add below media display (image/video player)
4. Pass itemId (S3 key), itemType ('media'), itemTitle (media filename or title)
5. Style appropriately for gallery context

**Architecture Guidance:**

- **itemId:** Use S3 key (e.g., `media/pictures/uuid_photo.jpg`)
- **itemTitle:** Use media title or filename
- **Conditional Rendering:** Only show CommentSection on detail view, not thumbnail grid

**Verification Checklist:**

- [ ] CommentSection appears on media detail view
- [ ] itemId matches media S3 key
- [ ] Comments specific to each media item
- [ ] Does NOT appear on gallery thumbnail grid
- [ ] Styling matches gallery design

**Testing Instructions:**

- Navigate to gallery
- Click media item to view full size
- Verify CommentSection appears
- Add comment → verify saves correctly
- Navigate back to grid → no comments showing
- Click different media → verify different comments

**Commit Message Template:**
```
feat(comments): integrate CommentSection into gallery pages

- Add CommentSection to media detail view
- Pass S3 key as itemId for media items
- Render only on detail view, not thumbnail grid

Estimated tokens: ~5000
```

**Estimated Tokens: ~5000**

---

## Task 7: Add Admin Moderation Controls

**Goal:** Implement admin-only delete button for comment moderation.

**Files to Modify:**
- `src/lib/components/comments/Comment.svelte` - Add admin delete logic

**Prerequisites:**
- Task 3 complete (Comment component exists)

**Implementation Steps:**

1. Read `isAdmin` prop in Comment component
2. Determine admin status from auth store (check `cognito:groups` claim)
3. Show delete button on all comments if admin
4. Style admin delete differently (e.g., red color, "Admin Delete" label)
5. Call admin delete endpoint: `DELETE /admin/comments/{commentId}`
6. Add confirmation modal: "Delete this comment? This action cannot be undone."

**Architecture Guidance:**

- **Admin Check:**
  ```typescript
  import { user } from '$lib/stores/auth';
  $: isAdmin = $user?.groups?.includes('Admins') ?? false;
  ```

- **Admin Endpoint:** Use separate endpoint for admin deletes (audit trail)

**Verification Checklist:**

- [ ] Delete button shows on all comments if user is admin
- [ ] Delete button hidden for non-admins
- [ ] Clicking delete shows confirmation modal
- [ ] Confirming delete calls admin endpoint
- [ ] Comment removed from UI after deletion
- [ ] Non-admin users cannot delete others' comments

**Testing Instructions:**

- Log in as admin user
- Navigate to any letter with comments
- Verify delete button appears on all comments
- Click delete on another user's comment → confirm → verify deleted
- Log in as regular user
- Verify delete only on own comments

**Commit Message Template:**
```
feat(comments): add admin moderation controls

- Show delete button on all comments for admins
- Call admin delete endpoint (DELETE /admin/comments/{id})
- Add confirmation modal for admin deletes
- Check cognito:groups claim for admin status

Estimated tokens: ~5000
```

**Estimated Tokens: ~5000**

---

## Task 8: Implement Comment Count Badge

**Goal:** Show comment count on letter list and gallery thumbnails.

**Files to Create/Modify:**
- Letter list component (homepage) - Add comment count badge
- Gallery thumbnail component - Add comment count badge

**Prerequisites:**
- CommentSection integrated into letter and gallery pages

**Implementation Steps:**

1. Create API endpoint or modify existing to return comment count for items
2. Fetch comment counts for displayed letters/media (batch query)
3. Display badge on thumbnails: "💬 5" or "5 comments"
4. Style badge to stand out (e.g., badge in corner, or below title)
5. Make badge clickable to scroll to comments section

**Architecture Guidance:**

- **Batch Query:** Create new endpoint `GET /comments/counts?itemIds=id1,id2,id3` to avoid N+1 queries
- **Caching:** Consider caching counts in browser (refresh every 5 minutes)
- **Scroll Behavior:** Use `document.getElementById('comments').scrollIntoView()` on click

**Verification Checklist:**

- [ ] Comment count badge appears on letter list
- [ ] Comment count badge appears on gallery thumbnails
- [ ] Counts are accurate
- [ ] Clicking badge navigates to comments section (if on same page) or letter page (if on list)
- [ ] Badge shows "0" or hidden if no comments

**Testing Instructions:**

- Add comments to a letter
- Navigate to homepage
- Verify letter shows correct comment count
- Click badge → verify scrolls to comments
- Repeat for gallery items

**Commit Message Template:**
```
feat(comments): add comment count badges to lists

- Create batch endpoint for comment counts
- Display count badge on letter list items
- Display count badge on gallery thumbnails
- Make badge clickable to scroll to comments

Estimated tokens: ~7000
```

**Estimated Tokens: ~7000**

---

## Task 9: Add Real-Time Comment Updates (Polling)

**Goal:** Implement periodic polling to fetch new comments while user is on page.

**Files to Modify:**
- `src/lib/components/comments/CommentSection.svelte` - Add polling logic

**Prerequisites:**
- Task 4 complete (CommentSection component exists)

**Implementation Steps:**

1. Add polling interval (30 seconds) when user is on page
2. Fetch comments and check for new commentIds not in current list
3. If new comments found, prepend to list with animation
4. Show notification: "New comments available. Click to refresh." (optional)
5. Stop polling when user navigates away (`onDestroy`)
6. Respect browser visibility API (pause when tab inactive)

**Architecture Guidance:**

- **Polling Implementation:**
  ```typescript
  onMount(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return; // Skip if tab inactive
      const result = await getComments(itemId, 10); // Fetch latest 10
      // Check for new comments...
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  });
  ```

- **Deduplication:** Track comment IDs to avoid showing duplicates

**Verification Checklist:**

- [ ] Polling starts when component mounts
- [ ] Fetches new comments every 30 seconds
- [ ] New comments appear automatically
- [ ] Polling stops when component unmounts
- [ ] Polling pauses when tab hidden
- [ ] No duplicate comments shown

**Testing Instructions:**

- Open letter page in browser
- In separate browser/incognito, add comment to same letter
- Wait 30 seconds
- Verify new comment appears in first browser without refresh

**Commit Message Template:**
```
feat(comments): add real-time updates with polling

- Poll for new comments every 30 seconds
- Prepend new comments to list automatically
- Pause polling when tab inactive
- Stop polling on unmount

Estimated tokens: ~5000
```

**Estimated Tokens: ~5000**

---

## Task 10: Add Comment Notifications Email Template

**Goal:** Create HTML email template for comment notifications.

**Files to Create:**
- `lambdas/notification-processor/templates/comment_notification.html` - Email template

**Prerequisites:**
- Phase 1 Task 7 complete (notification-processor Lambda exists)

**Implementation Steps:**

1. Create HTML email template with placeholders: `{userName}`, `{itemTitle}`, `{commentText}`, `{itemUrl}`
2. Use inline CSS (email clients don't support external stylesheets)
3. Keep design simple and accessible (plain text fallback)
4. Test with SES email preview or litmus.com
5. Update notification-processor Lambda to use template

**Architecture Guidance:**

- **Template Variables:**
  ```html
  <p>Hi there,</p>
  <p><strong>{userName}</strong> commented on "<strong>{itemTitle}</strong>":</p>
  <blockquote>{commentText}</blockquote>
  <a href="{itemUrl}">View the full discussion</a>
  ```

- **Inline CSS:** Use `style` attribute on all elements
- **Plain Text:** Always include plain text version (SES requirement)

**Verification Checklist:**

- [ ] HTML template created with placeholders
- [ ] Inline CSS styling applied
- [ ] Plain text version included
- [ ] Links are absolute URLs (https://...)
- [ ] Template renders correctly in Gmail, Outlook, Apple Mail
- [ ] Lambda updated to use template

**Testing Instructions:**

Send test email:
```python
# In notification-processor Lambda
html_body = render_template('comment_notification.html', {
  'userName': 'John Doe',
  'itemTitle': 'Christmas Letter 2015',
  'commentText': 'Great letter!',
  'itemUrl': 'https://holdthatthought.family/2015/christmas'
})

ses.send_email(
  Source='noreply@holdthatthought.family',
  Destination={'ToAddresses': ['test@example.com']},
  Message={
    'Subject': {'Data': 'New comment on "Christmas Letter 2015"'},
    'Body': {
      'Html': {'Data': html_body},
      'Text': {'Data': plain_text_version}
    }
  }
)
```

**Commit Message Template:**
```
feat(notifications): create comment email template

- Design HTML email template for comment notifications
- Add inline CSS for email client compatibility
- Include plain text fallback
- Update notification-processor to use template

Estimated tokens: ~4000
```

**Estimated Tokens: ~4000**

---

## Task 11: Add Accessibility Features

**Goal:** Ensure comment system is fully accessible (keyboard navigation, screen readers).

**Files to Modify:**
- All comment components (CommentForm, Comment, CommentSection)

**Prerequisites:**
- All comment components created

**Implementation Steps:**

1. Add ARIA labels to all interactive elements
2. Ensure all buttons are keyboard-accessible (tab navigation)
3. Add skip links ("Skip to comments")
4. Test with screen reader (NVDA, VoiceOver, or JAWS)
5. Add focus management (focus textarea after clicking edit)
6. Ensure color contrast meets WCAG AA standards
7. Add loading announcements for screen readers

**Architecture Guidance:**

- **ARIA Labels:**
  ```svelte
  <button aria-label="Like this comment">❤️ {reactionCount}</button>
  <textarea aria-label="Write a comment" aria-describedby="char-count"></textarea>
  <span id="char-count" aria-live="polite">{charCount}/2000</span>
  ```

- **Focus Management:**
  ```typescript
  function startEditing() {
    editing = true;
    tick().then(() => {
      document.getElementById('edit-textarea')?.focus();
    });
  }
  ```

**Verification Checklist:**

- [ ] All buttons have aria-label or visible text
- [ ] Textarea has aria-label
- [ ] Character counter has aria-live
- [ ] Tab key navigates through all interactive elements
- [ ] Enter key submits comment form
- [ ] Escape key cancels inline editing
- [ ] Screen reader announces loading states
- [ ] Color contrast ratio ≥ 4.5:1 for text
- [ ] Focus indicators visible on all interactive elements

**Testing Instructions:**

- Install screen reader (NVDA for Windows, VoiceOver for Mac)
- Navigate comment section with keyboard only (no mouse)
- Verify can add, edit, delete comments via keyboard
- Verify screen reader announces all actions
- Test with axe DevTools browser extension

**Commit Message Template:**
```
feat(comments): add accessibility features

- Add ARIA labels to all interactive elements
- Implement keyboard navigation (tab, enter, escape)
- Add focus management for inline editing
- Ensure WCAG AA color contrast
- Add loading state announcements for screen readers

Estimated tokens: ~6000
```

**Estimated Tokens: ~6000**

---

## Task 12: Add Mobile-Responsive Design

**Goal:** Ensure comment UI works well on mobile devices (phones, tablets).

**Files to Modify:**
- All comment components (adjust CSS)

**Prerequisites:**
- All comment components created

**Implementation Steps:**

1. Test comment UI on mobile viewport (use browser DevTools or real device)
2. Adjust spacing, font sizes for small screens
3. Make buttons touch-friendly (min 44x44px tap targets)
4. Stack elements vertically on narrow screens
5. Reduce avatar size on mobile
6. Test landscape orientation

**Architecture Guidance:**

- **Responsive CSS:**
  ```css
  .comment {
    padding: 1rem;
  }
  
  @media (max-width: 640px) {
    .comment {
      padding: 0.5rem;
    }
    
    .avatar {
      width: 32px;
      height: 32px;
    }
  }
  ```

- **Touch Targets:** Ensure buttons are at least 44x44px on mobile

**Verification Checklist:**

- [ ] Comment section renders correctly on 320px width (iPhone SE)
- [ ] Comment section renders correctly on 768px width (iPad)
- [ ] Buttons are easy to tap (min 44x44px)
- [ ] No horizontal scrolling
- [ ] Text is readable (min 16px font size)
- [ ] Forms are usable (textarea not too small)

**Testing Instructions:**

- Open DevTools → Device Mode
- Test at 320px, 375px, 768px, 1024px widths
- Verify layout adapts gracefully
- Test on real mobile device if available

**Commit Message Template:**
```
feat(comments): add mobile-responsive design

- Adjust spacing and font sizes for small screens
- Make buttons touch-friendly (min 44x44px)
- Stack elements vertically on narrow viewports
- Reduce avatar size on mobile
- Test on 320px to 1024px widths

Estimated tokens: ~5000
```

**Estimated Tokens: ~5000**

---

## Phase Verification

Before proceeding to Phase 3, verify:

### Functionality
- [ ] Can add comments on letter pages
- [ ] Can add comments on gallery media
- [ ] Can edit own comments (inline editing)
- [ ] Can delete own comments (with confirmation)
- [ ] Admins can delete any comment
- [ ] Can like/unlike comments
- [ ] Reaction count updates optimistically
- [ ] Comments paginate correctly ("Load More")
- [ ] Email notifications sent for new comments
- [ ] Email notifications sent for reactions

### UI/UX
- [ ] Comment section visually integrated with site design
- [ ] Loading states show while fetching
- [ ] Empty state shows if no comments
- [ ] Error messages display on failures
- [ ] Character counter updates as user types
- [ ] Submit button disabled appropriately
- [ ] Comments sorted chronologically
- [ ] Timestamps show relative time ("2 hours ago")

### Accessibility
- [ ] All interactive elements keyboard-accessible
- [ ] ARIA labels present on all inputs/buttons
- [ ] Screen reader announces loading states
- [ ] Color contrast meets WCAG AA
- [ ] Focus management works correctly

### Mobile
- [ ] Comment section renders on 320px width
- [ ] Buttons are touch-friendly
- [ ] No horizontal scrolling
- [ ] Text is readable (16px min)

### Performance
- [ ] Comments load in < 1 second
- [ ] Pagination doesn't reload all comments
- [ ] Polling doesn't cause memory leaks
- [ ] Optimistic updates feel instant

---

## Known Limitations & Technical Debt

**Limitations:**

1. **No @mentions:** Cannot tag other users in comments
   - **Future:** Add @mention autocomplete and notifications

2. **No rich text:** Comments are plain text only
   - **Future:** Add Markdown support or rich text editor

3. **Polling-based updates:** Not truly real-time
   - **Acceptable:** 30-second delay is fine for family use case

4. **No comment search:** Cannot search comments by keyword
   - **Future:** Add full-text search with OpenSearch

**Technical Debt:**

- Comment service makes individual API calls (no batching)
  - **Refactor:** Batch API calls for comment counts

- Email templates hardcoded in Lambda
  - **Refactor:** Move to S3 or template service

---

## Next Steps

Proceed to **Phase 3: User Profiles** to build profile pages with comment history and activity tracking.
