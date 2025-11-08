# Phase 3: User Profiles

## Phase Goal

Build user profile pages that display bio, family relationships, activity statistics, and comment history. Implement privacy controls allowing users to hide their profiles. Enable users to edit their own profiles and navigate from comments to profiles seamlessly.

**Success Criteria:**
- Profile pages accessible at `/profile/{userId}`
- Users can edit their own profiles (bio, family info, photo)
- Profile displays comment history with links back to original items
- Activity stats show comment count, media uploads, join date
- Privacy toggle hides profiles from non-owners
- Profile links work from comment usernames

**Estimated Tokens: ~80,000**

---

## Prerequisites

Before starting this phase:

- [ ] Phase 1 complete (profile-api Lambda functional)
- [ ] Phase 2 complete (comments display usernames)
- [ ] Can fetch user profile via API (verify with curl)
- [ ] Understand SvelteKit routing ([userId] dynamic routes)

---

## Task 1: Create Profile Service API Client

**Goal:** Build TypeScript service layer for profile operations.

**Files to Create:**
- `src/lib/services/profileService.ts` - Profile API client
- `src/lib/types/profile.ts` - TypeScript interfaces

**Implementation Steps:**

1. Define TypeScript interfaces for UserProfile, ActivityStats
2. Implement API client functions:
   - `getProfile(userId)` - Fetch user profile
   - `updateProfile(updates)` - Update own profile
   - `getCommentHistory(userId, limit, lastKey)` - Get user's comments
   - `uploadProfilePhoto(file)` - Upload profile photo (presigned URL)
3. Handle 403 errors (private profiles)
4. Handle 404 errors (user not found)

**Architecture Guidance:**

Example interface:
```typescript
export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  profilePhotoUrl?: string;
  bio?: string;
  familyRelationship?: string;
  generation?: string;
  familyBranch?: string;
  joinedDate: string;
  isProfilePrivate: boolean;
  commentCount: number;
  mediaUploadCount: number;
  lastActive: string;
}
```

**Verification Checklist:**

- [ ] TypeScript interfaces defined
- [ ] All API functions implemented
- [ ] Error handling for 403 (private profile)
- [ ] Error handling for 404 (not found)
- [ ] No TypeScript errors

**Commit Message Template:**
```
feat(profile): create profile API service client

- Define UserProfile and ActivityStats interfaces
- Implement getProfile, updateProfile, getCommentHistory
- Add uploadProfilePhoto for photo uploads
- Handle private profile errors (403)

Estimated tokens: ~6000
```

**Estimated Tokens: ~6000**

---

## Task 2: Create ProfileCard Component

**Goal:** Build component to display user profile information.

**Files to Create:**
- `src/lib/components/profile/ProfileCard.svelte` - Main profile display

**Implementation Steps:**

1. Create component with sections: Header, About, Family, Stats
2. Header: Show photo, display name, "Edit Profile" button (if own)
3. About: Show bio text (preserve line breaks)
4. Family: Show relationship, generation, branch
5. Stats: Show joined date, comment count, media uploads, last active
6. If profile private and not owner/admin, show "Private Profile" message
7. Style with TailwindCSS + DaisyUI cards

**Architecture Guidance:**

- **Component Props:**
  - `profile: UserProfile`
  - `isOwner: boolean` - True if viewing own profile
  - `isAdmin: boolean` - For admin access to private profiles

- **Conditional Rendering:**
  ```svelte
  {#if profile.isProfilePrivate && !isOwner && !isAdmin}
    <div class="private-profile">
      <p>This profile is private.</p>
    </div>
  {:else}
    <!-- Show full profile -->
  {/if}
  ```

**Verification Checklist:**

- [ ] Displays profile photo (or default avatar)
- [ ] Shows display name prominently
- [ ] Shows bio with preserved line breaks
- [ ] Shows family info if set
- [ ] Shows activity stats (counts, dates)
- [ ] "Edit Profile" button visible only for owner
- [ ] Private profiles show minimal info to non-owners
- [ ] Mobile-responsive

**Commit Message Template:**
```
feat(profile): create ProfileCard component

- Display profile photo, name, bio
- Show family relationship info
- Display activity stats (comments, uploads, join date)
- Add privacy check for private profiles
- Show "Edit Profile" button for owner
- Style with TailwindCSS + DaisyUI

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 3: Create CommentHistory Component

**Goal:** Build component to display user's comment history with links to original items.

**Files to Create:**
- `src/lib/components/profile/CommentHistory.svelte` - Comment history list

**Implementation Steps:**

1. Fetch user's comments via `getCommentHistory` service
2. Display list of comments with:
   - Comment snippet (first 150 characters)
   - Item title (linked to original letter/media)
   - Timestamp
   - Reaction count
3. Implement pagination ("Load More" button)
4. Make item title clickable → navigate to item page + scroll to comment
5. Show empty state if user has no comments

**Architecture Guidance:**

- **Component Props:**
  - `userId: string`

- **Navigation to Comment:**
  ```typescript
  function navigateToComment(itemId: string, commentId: string) {
    goto(`${itemId}#comment-${commentId}`);
  }
  ```

- **URL Fragment:** Use comment ID as fragment, add scroll behavior in CommentSection

**Verification Checklist:**

- [ ] Fetches user's comment history on mount
- [ ] Displays comment snippets with item titles
- [ ] Item titles are clickable links
- [ ] Clicking link navigates to item page
- [ ] Pagination works ("Load More")
- [ ] Shows empty state if no comments
- [ ] Mobile-responsive

**Commit Message Template:**
```
feat(profile): create CommentHistory component

- Fetch and display user's comment history
- Show comment snippets with item titles
- Link to original items (letters/media)
- Implement pagination for long histories
- Add empty state for users with no comments

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 4: Create Profile Page Route

**Goal:** Create SvelteKit page at `/profile/[userId]` to display user profiles.

**Files to Create:**
- `src/routes/profile/[userId]/+page.svelte` - Profile page
- `src/routes/profile/[userId]/+page.ts` - Page load function (optional)

**Implementation Steps:**

1. Create dynamic route with `[userId]` parameter
2. Load profile data on page mount
3. Determine if viewing own profile (compare userId to current user)
4. Check admin status from auth store
5. Render ProfileCard and CommentHistory components
6. Handle loading state
7. Handle errors (404, 403)

**Architecture Guidance:**

- **Page Load:**
  ```svelte
  <script>
    import { page } from '$app/stores';
    import { user } from '$lib/stores/auth';
    import { getProfile } from '$lib/services/profileService';
    
    let profile = null;
    let loading = true;
    let error = null;
    
    $: userId = $page.params.userId;
    $: isOwner = $user?.userId === userId;
    $: isAdmin = $user?.groups?.includes('Admins') ?? false;
    
    onMount(async () => {
      const result = await getProfile(userId);
      if (result.success) {
        profile = result.data;
      } else {
        error = result.error;
      }
      loading = false;
    });
  </script>
  ```

**Verification Checklist:**

- [ ] Page accessible at `/profile/{userId}`
- [ ] Fetches profile data on mount
- [ ] Shows loading skeleton while fetching
- [ ] Displays ProfileCard with correct data
- [ ] Displays CommentHistory below ProfileCard
- [ ] "Edit Profile" button visible only for owner
- [ ] Shows error message if profile not found (404)
- [ ] Shows "Private Profile" if unauthorized (403)

**Commit Message Template:**
```
feat(profile): create profile page route

- Add /profile/[userId] dynamic route
- Fetch profile data on page load
- Display ProfileCard and CommentHistory components
- Handle loading and error states
- Check ownership and admin status

Estimated tokens: ~7000
```

**Estimated Tokens: ~7000**

---

## Task 5: Create Profile Settings Page

**Goal:** Create page at `/profile/settings` for users to edit their own profiles.

**Files to Create:**
- `src/routes/profile/settings/+page.svelte` - Profile settings form

**Implementation Steps:**

1. Create settings page (auth required)
2. Load current user's profile
3. Create form with fields:
   - Display name (text input)
   - Bio (textarea, max 500 chars)
   - Family relationship (text input)
   - Generation (text input)
   - Family branch (text input)
   - Profile photo (file upload)
   - Privacy toggle (checkbox: "Make profile private")
4. Validate inputs (max lengths)
5. Call `updateProfile` service on save
6. Show success message after save
7. Redirect to own profile page after save

**Architecture Guidance:**

- **Form State:**
  ```svelte
  <script>
    let displayName = '';
    let bio = '';
    let familyRelationship = '';
    let generation = '';
    let familyBranch = '';
    let isProfilePrivate = false;
    let photoFile = null;
    
    async function handleSave() {
      // Upload photo if changed
      if (photoFile) {
        const photoUrl = await uploadProfilePhoto(photoFile);
        // Include in update
      }
      
      await updateProfile({
        displayName,
        bio,
        familyRelationship,
        generation,
        familyBranch,
        isProfilePrivate
      });
      
      goto(`/profile/${$user.userId}`);
    }
  </script>
  ```

**Verification Checklist:**

- [ ] Page accessible at `/profile/settings`
- [ ] Requires authentication (redirect to login if not authenticated)
- [ ] Loads current profile data into form
- [ ] All fields editable
- [ ] Bio character counter (max 500)
- [ ] Photo upload works (preview before save)
- [ ] Privacy toggle works
- [ ] Save button disabled while saving
- [ ] Success message shows after save
- [ ] Redirects to profile page after save

**Commit Message Template:**
```
feat(profile): create profile settings page

- Add /profile/settings route
- Create form for editing profile fields
- Add bio character counter (max 500)
- Implement profile photo upload
- Add privacy toggle
- Redirect to profile after save

Estimated tokens: ~10000
```

**Estimated Tokens: ~10000**

---

## Task 6: Add Profile Links to Comments

**Goal:** Make comment usernames clickable links to profile pages.

**Files to Modify:**
- `src/lib/components/comments/Comment.svelte` - Add link to userName

**Implementation Steps:**

1. Wrap userName in `<a>` tag
2. Link to `/profile/{userId}`
3. Style link appropriately (underline on hover, color)
4. Open in same tab (not new tab)

**Architecture Guidance:**

```svelte
<a href="/profile/{comment.userId}" class="user-link">
  {comment.userName}
</a>
```

**Verification Checklist:**

- [ ] Comment usernames are clickable
- [ ] Clicking navigates to user's profile page
- [ ] Link styling matches site design
- [ ] Links work from all comment locations (letters, gallery)

**Commit Message Template:**
```
feat(profile): add profile links to comment usernames

- Make comment userNames clickable links
- Link to /profile/{userId}
- Style links with hover effects

Estimated tokens: ~3000
```

**Estimated Tokens: ~3000**

---

## Task 7: Add Profile Navigation to Site Header

**Goal:** Add "My Profile" link to site navigation header.

**Files to Modify:**
- Site header/navigation component (identify location)

**Implementation Steps:**

1. Locate site header component
2. Add dropdown menu or link for authenticated users
3. Include:
   - "My Profile" link → `/profile/{currentUserId}`
   - "Settings" link → `/profile/settings`
   - Existing logout link
4. Style dropdown/menu

**Architecture Guidance:**

- **Dropdown Menu:**
  ```svelte
  {#if $user}
    <div class="dropdown">
      <button>{$user.displayName}</button>
      <ul class="menu">
        <li><a href="/profile/{$user.userId}">My Profile</a></li>
        <li><a href="/profile/settings">Settings</a></li>
        <li><button on:click={logout}>Logout</button></li>
      </ul>
    </div>
  {/if}
  ```

**Verification Checklist:**

- [ ] "My Profile" link appears in header for authenticated users
- [ ] Clicking navigates to own profile page
- [ ] "Settings" link accessible from dropdown/menu
- [ ] Dropdown/menu styled consistently with site

**Commit Message Template:**
```
feat(profile): add profile navigation to site header

- Add "My Profile" link to header dropdown
- Add "Settings" link for profile editing
- Show dropdown only for authenticated users

Estimated tokens: ~4000
```

**Estimated Tokens: ~4000**

---

## Task 8: Implement Profile Photo Upload

**Goal:** Build photo upload functionality with image preview and S3 storage.

**Files to Modify:**
- `src/routes/profile/settings/+page.svelte` - Add photo upload UI
- `src/lib/services/profileService.ts` - Add uploadProfilePhoto function

**Implementation Steps:**

1. Add file input to settings form
2. Show image preview after selection
3. Validate file type (jpg, png, gif, max 5MB)
4. On save, get presigned URL from backend
5. Upload to S3 using presigned URL
6. Save S3 URL in profile
7. Update profilePhotoUrl in UserProfiles table

**Architecture Guidance:**

- **File Validation:**
  ```typescript
  function validatePhoto(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Use JPG, PNG, or GIF.');
    }
    
    if (file.size > maxSize) {
      throw new Error('File too large. Max 5MB.');
    }
    
    return true;
  }
  ```

- **Image Preview:**
  ```svelte
  <script>
    let previewUrl = '';
    
    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        previewUrl = URL.createObjectURL(file);
      }
    }
  </script>
  
  {#if previewUrl}
    <img src={previewUrl} alt="Preview" />
  {/if}
  ```

**Verification Checklist:**

- [ ] File input accepts only images
- [ ] Shows preview after selection
- [ ] Validates file type and size
- [ ] Uploads to S3 via presigned URL
- [ ] Updates profile with new photo URL
- [ ] Photo appears on profile page after save

**Commit Message Template:**
```
feat(profile): implement profile photo upload

- Add file input to settings form
- Show image preview before upload
- Validate file type (JPG, PNG, GIF) and size (max 5MB)
- Upload to S3 using presigned URL
- Update profile with new photo URL

Estimated tokens: ~8000
```

**Estimated Tokens: ~8000**

---

## Task 9: Backfill Existing Users into UserProfiles Table

**Goal:** Create migration script to populate UserProfiles table from Cognito User Pool.

**Files to Create:**
- `scripts/backfill-user-profiles.js` - Migration script

**Prerequisites:**
- Phase 1 complete (UserProfiles table exists)

**Implementation Steps:**

1. Create Node.js script
2. Fetch all users from Cognito User Pool
3. For each user, create UserProfiles entry:
   - userId = Cognito sub
   - email = email attribute
   - displayName = name attribute (or email if missing)
   - joinedDate = Cognito UserCreateDate
   - All other fields = defaults
4. Check if user already exists before inserting (idempotent)
5. Log progress and errors

**Architecture Guidance:**

```javascript
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

async function backfillUsers() {
  const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
  const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  
  const response = await cognitoClient.send(new ListUsersCommand({
    UserPoolId: process.env.USER_POOL_ID
  }));
  
  for (const user of response.Users) {
    const userId = user.Attributes.find(a => a.Name === 'sub').Value;
    const email = user.Attributes.find(a => a.Name === 'email').Value;
    
    // Check if already exists
    const existing = await ddbClient.send(new GetCommand({
      TableName: 'hold-that-thought-user-profiles',
      Key: { userId }
    }));
    
    if (!existing.Item) {
      await ddbClient.send(new PutCommand({
        TableName: 'hold-that-thought-user-profiles',
        Item: {
          userId,
          email,
          displayName: email.split('@')[0],
          joinedDate: user.UserCreateDate.toISOString(),
          isProfilePrivate: false,
          commentCount: 0,
          mediaUploadCount: 0,
          lastActive: new Date().toISOString()
        }
      }));
      
      console.log(`Created profile for ${email}`);
    }
  }
}
```

**Verification Checklist:**

- [ ] Script fetches all Cognito users
- [ ] Creates UserProfiles entries for each
- [ ] Idempotent (can run multiple times safely)
- [ ] Logs progress
- [ ] Handles pagination if > 60 users

**Commit Message Template:**
```
chore(profile): add user profile backfill script

- Create script to migrate Cognito users to UserProfiles table
- Extract userId, email, joinedDate from Cognito
- Set default values for new fields
- Make script idempotent (check before insert)

Estimated tokens: ~6000
```

**Estimated Tokens: ~6000**

---

## Task 10: Add Activity Stats Dashboard (Admin Only)

**Goal:** Create admin-only page showing aggregate activity stats.

**Files to Create:**
- `src/routes/admin/activity/+page.svelte` - Activity dashboard (optional, bonus task)

**Implementation Steps:**

1. Create admin route (require admin auth)
2. Create Lambda endpoint to aggregate stats:
   - Total users
   - Total comments
   - Total messages
   - Active users (last 7 days)
3. Display stats in dashboard cards
4. Add charts (optional, use Chart.js or similar)

**Architecture Guidance:**

- **Admin Check:**
  ```svelte
  <script>
    import { user } from '$lib/stores/auth';
    import { goto } from '$app/navigation';
    
    onMount(() => {
      if (!$user?.groups?.includes('Admins')) {
        goto('/'); // Redirect non-admins
      }
    });
  </script>
  ```

**Verification Checklist:**

- [ ] Page requires admin auth
- [ ] Displays aggregate stats
- [ ] Stats are accurate
- [ ] Styled with cards/charts

**Commit Message Template:**
```
feat(admin): add activity stats dashboard

- Create admin-only activity page
- Display total users, comments, messages
- Show active users (last 7 days)
- Add charts for visual display

Estimated tokens: ~7000
```

**Estimated Tokens: ~7000**

---

## Phase Verification

Before proceeding to Phase 4, verify:

### Functionality
- [ ] Profile pages load correctly
- [ ] Can view other users' profiles
- [ ] Can edit own profile
- [ ] Profile photo uploads work
- [ ] Comment history displays correctly
- [ ] Clicking comment links navigates to original items
- [ ] Private profiles hidden from non-owners
- [ ] Admin can view all profiles

### UI/UX
- [ ] ProfileCard displays all info clearly
- [ ] CommentHistory shows comment snippets with links
- [ ] Settings form is intuitive
- [ ] Bio character counter works
- [ ] Privacy toggle works
- [ ] Success messages display after save

### Navigation
- [ ] "My Profile" link in header works
- [ ] Comment usernames link to profiles
- [ ] Profile page URL structure makes sense

### Data
- [ ] Existing users backfilled into UserProfiles table
- [ ] Activity stats update correctly (commentCount, lastActive)
- [ ] Profile data persists across page refreshes

---

## Known Limitations & Technical Debt

**Limitations:**

1. **No family tree visualization:** Family relationships are text only
   - **Future:** Build interactive family tree component

2. **Basic activity stats:** Only comment count and media uploads tracked
   - **Future:** Add more granular analytics (comments per month, etc.)

3. **No user search:** Cannot search for users by name
   - **Future:** Add user directory with search

**Technical Debt:**

- Profile photo upload uses presigned URLs (good) but no image resizing
  - **Refactor:** Add Lambda to resize images on upload (save storage)

- Comment history loads all pages to find specific comment
  - **Refactor:** Add deep-linking with comment highlighting

---

## Review Feedback (Iteration 1)

### Task 4: Profile Page Route - Admin Check Implementation

> **Consider:** In `src/routes/profile/[userId]/+page.svelte:16`, the admin check is hardcoded to `false` with a TODO comment. Looking at Phase 0 architecture guidance and the implementation in `src/lib/components/comments/CommentSection.svelte:22`, what pattern should be used to properly check if a user is in the Admins group?
>
> **Think about:** The plan in Phase 3 Task 4 (line 251) states "Check admin status from auth store". The Phase Verification section (line 725) requires "Admin can view all profiles". How does hardcoding `isAdmin = false` affect this requirement?
>
> **Reflect:** In `src/lib/components/comments/CommentSection.svelte`, you successfully implemented the admin check using `$currentUser?.['cognito:groups']?.includes('Admins')`. Should the profile page use the same pattern for consistency?

---

## Next Steps

After addressing the review feedback above, proceed to **Phase 4: Messaging System** to build direct messaging functionality.
