# Phase 3: Frontend - Dynamic Letters & Editor

## Phase Goal

Transform the frontend from static markdown routes to dynamic letter fetching, implement the split-view markdown editor, and add version history UI. This phase also removes all frontmatter processing from the frontend codebase.

**Success Criteria:**
- Letters fetched dynamically from API (not static files)
- Split-view markdown editor functional for authenticated users
- Version history UI with simple revert capability
- Frontmatter processing removed from letter-related code
- Static letter index page with dynamic content loading

**Estimated Tokens:** ~20,000

## Prerequisites

- Phase 2 complete (Letters API functional)
- API endpoint accessible from frontend
- Authentication working (Cognito tokens)

## Tasks

### Task 1: Create Letters Service

**Goal:** Create a TypeScript service for interacting with the Letters API.

**Files to Create:**
- `frontend/lib/services/letters-service.ts` - Letters API client

**Prerequisites:**
- Phase 2 complete (API endpoints exist)

**Implementation Steps:**
1. Create service following existing patterns (see `gallery-service.ts` which passes `authToken` as parameter):
   ```typescript
   import { PUBLIC_API_GATEWAY_URL } from '$env/static/public'

   const API_URL = PUBLIC_API_GATEWAY_URL

   export interface Letter {
     date: string
     title: string
     originalTitle?: string
     content: string
     pdfKey?: string
     createdAt: string
     updatedAt: string
     lastEditedBy?: string
     versionCount: number
   }

   export interface LetterListItem {
     date: string
     title: string
     originalTitle?: string
     updatedAt: string
   }

   export interface LetterVersion {
     timestamp: string
     versionNumber: number
     editedBy: string
     editedAt: string
   }

   // Following gallery-service.ts pattern: pass authToken as parameter
   export async function listLetters(
     authToken: string,
     limit = 50,
     cursor?: string
   ): Promise<{
     items: LetterListItem[]
     nextCursor: string | null
   }> {
     const params = new URLSearchParams({ limit: String(limit) })
     if (cursor) params.set('cursor', cursor)

     const response = await fetch(`${API_URL}letters?${params}`, {
       headers: {
         'Authorization': `Bearer ${authToken}`,
         'Content-Type': 'application/json',
       },
     })

     if (!response.ok) throw new Error('Failed to fetch letters')
     return response.json()
   }

   export async function getLetter(date: string, authToken: string): Promise<Letter> { ... }
   export async function updateLetter(date: string, content: string, title: string | undefined, authToken: string): Promise<Letter> { ... }
   export async function getVersions(date: string, authToken: string): Promise<LetterVersion[]> { ... }
   export async function revertToVersion(date: string, versionTimestamp: string, authToken: string): Promise<void> { ... }
   export async function getPdfUrl(date: string, authToken: string): Promise<string> { ... }
   ```
2. Pass authentication token as parameter (matching gallery-service.ts pattern)
3. Handle API errors consistently
4. Add TypeScript types for all responses

**Important Notes:**
- The `frontend/routes/api/letters/` directory contains existing local file-based API endpoints that read from local filesystem. These will be deprecated/removed as part of Task 9 when we switch to the new API Gateway-backed system.
- Auth tokens are obtained from `authTokens` store in `$lib/auth/auth-store.ts` (e.g., `$authTokens?.accessToken`)

**Verification Checklist:**
- [ ] All API methods implemented
- [ ] Authentication headers included
- [ ] Error handling consistent
- [ ] TypeScript types accurate
- [ ] Works with existing auth store

**Testing Instructions:**
Create `tests/unit/frontend/letters-service.test.ts` (or test manually):
- Mock fetch and verify correct URL construction
- Verify auth headers included
- Verify error handling

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(frontend): create letters service for API interaction

- Add TypeScript interfaces for letter data
- Implement all letters API methods
- Handle authentication and errors
```

---

### Task 2: Create Letters Index Route

**Goal:** Create the main letters listing page that shows all letters chronologically.

**Files to Create:**
- `frontend/routes/letters/+page.svelte` - Letters index page
- `frontend/routes/letters/+page.ts` - Page load function

**Note:** The `frontend/routes/letters/` directory does NOT exist - it must be created. This is a NEW page route (distinct from the existing `frontend/routes/api/letters/` API routes which will be deprecated).

**Prerequisites:**
- Task 1 complete (letters service exists)

**Implementation Steps:**
1. Create `+page.ts` for data loading:
   ```typescript
   import type { PageLoad } from './$types'
   import { listLetters } from '$lib/services/letters-service'

   export const load: PageLoad = async () => {
     try {
       const { items, nextCursor } = await listLetters(50)
       return { letters: items, nextCursor }
     } catch (error) {
       return { letters: [], nextCursor: null, error: 'Failed to load letters' }
     }
   }
   ```

2. Create `+page.svelte`:
   ```svelte
   <script lang="ts">
     import type { PageData } from './$types'

     export let data: PageData

     let letters = data.letters
     let nextCursor = data.nextCursor
     let loading = false

     async function loadMore() {
       if (!nextCursor || loading) return
       loading = true
       const result = await listLetters(50, nextCursor)
       letters = [...letters, ...result.items]
       nextCursor = result.nextCursor
       loading = false
     }
   </script>

   <div class="container mx-auto p-4">
     <h1 class="text-3xl font-bold mb-6">Family Letters</h1>

     <div class="space-y-4">
       {#each letters as letter}
         <a href="/letters/{letter.date}" class="block p-4 border rounded hover:bg-base-200">
           <div class="flex justify-between">
             <h2 class="text-xl">{letter.title}</h2>
             <span class="text-sm text-gray-500">{formatDate(letter.date)}</span>
           </div>
           {#if letter.originalTitle && letter.originalTitle !== letter.title}
             <p class="text-sm text-gray-400">Originally: {letter.originalTitle}</p>
           {/if}
         </a>
       {/each}
     </div>

     {#if nextCursor}
       <button class="btn btn-primary mt-4" on:click={loadMore} disabled={loading}>
         {loading ? 'Loading...' : 'Load More'}
       </button>
     {/if}
   </div>
   ```
3. Style with existing Tailwind/DaisyUI classes
4. Add date formatting helper

**Verification Checklist:**
- [ ] Displays list of letters
- [ ] Links to individual letter pages
- [ ] Pagination loads more letters
- [ ] Handles empty state
- [ ] Matches existing site styling

**Testing Instructions:**
- Navigate to /letters in browser
- Verify letters displayed
- Click "Load More" to test pagination
- Click letter to verify navigation

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(frontend): create letters index page

- Display chronological list of letters
- Implement infinite scroll pagination
- Link to individual letter pages
```

---

### Task 3: Create Letter Detail Route

**Goal:** Create the individual letter viewing page with content display and PDF download.

**Files to Create:**
- `frontend/routes/letters/[date]/+page.svelte` - Letter detail page
- `frontend/routes/letters/[date]/+page.ts` - Page load function

**Prerequisites:**
- Task 2 complete (index page exists)
- Task 1 complete (service exists)

**Implementation Steps:**
1. Create `+page.ts`:
   ```typescript
   import type { PageLoad } from './$types'
   import { getLetter } from '$lib/services/letters-service'

   export const load: PageLoad = async ({ params }) => {
     try {
       const letter = await getLetter(params.date)
       return { letter }
     } catch (error) {
       return { letter: null, error: 'Letter not found' }
     }
   }
   ```

2. Create `+page.svelte`:
   ```svelte
   <script lang="ts">
     import { marked } from 'marked'
     import { isAuthenticated, authTokens } from '$lib/auth/auth-store'
     import { getPdfUrl } from '$lib/services/letters-service'

     export let data

     let letter = data.letter
     let pdfLoading = false

     async function downloadPdf() {
       if (!$authTokens?.accessToken) return
       pdfLoading = true
       try {
         const url = await getPdfUrl(letter.date, $authTokens.accessToken)
         window.open(url, '_blank')
       } catch (e) {
         console.error('Failed to get PDF URL')
       }
       pdfLoading = false
     }

     $: htmlContent = letter ? marked(letter.content) : ''
   </script>

   {#if letter}
     <article class="container mx-auto p-4 max-w-4xl">
       <header class="mb-8">
         <h1 class="text-3xl font-bold">{letter.title}</h1>
         <div class="flex gap-4 mt-2 text-sm text-gray-500">
           <span>{formatDate(letter.date)}</span>
           {#if letter.versionCount > 0}
             <span>Edited {letter.versionCount} times</span>
           {/if}
         </div>

         <div class="flex gap-2 mt-4">
           <button class="btn btn-outline btn-sm" on:click={downloadPdf} disabled={pdfLoading}>
             {pdfLoading ? 'Loading...' : 'Download Original PDF'}
           </button>

           {#if $isAuthenticated}
             <a href="/letters/{letter.date}/edit" class="btn btn-primary btn-sm">
               Edit Letter
             </a>
           {/if}
         </div>
       </header>

       <div class="prose max-w-none">
         {@html htmlContent}
       </div>
     </article>
   {:else}
     <div class="container mx-auto p-4">
       <p class="text-error">Letter not found</p>
       <a href="/letters" class="btn btn-link">Back to letters</a>
     </div>
   {/if}
   ```
3. Use `marked` library for markdown rendering
4. Add PDF download button
5. Add edit button for authenticated users

**Verification Checklist:**
- [ ] Displays letter content rendered as HTML
- [ ] Shows title and date
- [ ] PDF download works
- [ ] Edit button visible when authenticated
- [ ] 404 handling for missing letters

**Testing Instructions:**
- Navigate to /letters/2016-02-10 (valid date)
- Verify content displays correctly
- Click PDF download
- Verify edit button appears when logged in

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(frontend): create letter detail page

- Display rendered markdown content
- Add PDF download functionality
- Add edit button for authenticated users
```

---

### Task 4: Create Split-View Markdown Editor Component

**Goal:** Create a reusable split-view editor component with markdown on left and preview on right.

**Files to Create:**
- `frontend/lib/components/MarkdownEditor.svelte` - Split-view editor component

**Prerequisites:**
- None (standalone component)

**Implementation Steps:**
1. Create the editor component:
   ```svelte
   <script lang="ts">
     import { marked } from 'marked'
     import { createEventDispatcher } from 'svelte'

     export let content: string = ''
     export let title: string = ''
     export let saving: boolean = false

     const dispatch = createEventDispatcher()

     $: preview = marked(content)

     function handleSave() {
       dispatch('save', { content, title })
     }

     function handleCancel() {
       dispatch('cancel')
     }
   </script>

   <div class="flex flex-col h-full">
     <!-- Title input -->
     <div class="mb-4">
       <label class="label">
         <span class="label-text">Title</span>
       </label>
       <input
         type="text"
         class="input input-bordered w-full"
         bind:value={title}
         placeholder="Letter title"
       />
     </div>

     <!-- Split view -->
     <div class="flex-1 grid grid-cols-2 gap-4 min-h-[500px]">
       <!-- Editor pane -->
       <div class="flex flex-col">
         <label class="label">
           <span class="label-text">Markdown</span>
         </label>
         <textarea
           class="textarea textarea-bordered flex-1 font-mono text-sm"
           bind:value={content}
           placeholder="Write your content in markdown..."
         />
       </div>

       <!-- Preview pane -->
       <div class="flex flex-col">
         <label class="label">
           <span class="label-text">Preview</span>
         </label>
         <div class="border rounded p-4 flex-1 overflow-auto prose max-w-none bg-base-100">
           {@html preview}
         </div>
       </div>
     </div>

     <!-- Actions -->
     <div class="flex justify-end gap-2 mt-4">
       <button class="btn btn-ghost" on:click={handleCancel} disabled={saving}>
         Cancel
       </button>
       <button class="btn btn-primary" on:click={handleSave} disabled={saving}>
         {saving ? 'Saving...' : 'Save Changes'}
       </button>
     </div>
   </div>
   ```
2. Live preview updates as user types
3. Dispatch events for save/cancel
4. Responsive layout

**Verification Checklist:**
- [ ] Split view displays editor and preview
- [ ] Preview updates in real-time
- [ ] Title input functional
- [ ] Save/cancel buttons dispatch events
- [ ] Handles long content with scroll

**Testing Instructions:**
- Import component in a test page
- Type in editor, verify preview updates
- Verify save/cancel events fire

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(frontend): create split-view markdown editor component

- Implement side-by-side editor and preview
- Live markdown preview as user types
- Title editing support
```

---

### Task 5: Create Letter Edit Page

**Goal:** Create the letter editing page using the split-view editor with save functionality.

**Files to Create:**
- `frontend/routes/letters/[date]/edit/+page.svelte` - Edit page
- `frontend/routes/letters/[date]/edit/+page.ts` - Page load

**Prerequisites:**
- Task 4 complete (editor component)
- Task 1 complete (service has updateLetter)

**Implementation Steps:**
1. Create `+page.ts`:
   ```typescript
   import type { PageLoad } from './$types'
   import { getLetter } from '$lib/services/letters-service'

   export const load: PageLoad = async ({ params, parent }) => {
     // Auth check handled in component (need access to stores)
     // Parent data may include auth state if needed
     return { date: params.date }
   }
   ```

2. Create `+page.svelte`:
   ```svelte
   <script lang="ts">
     import { goto } from '$app/navigation'
     import { onMount } from 'svelte'
     import MarkdownEditor from '$lib/components/MarkdownEditor.svelte'
     import { getLetter, updateLetter } from '$lib/services/letters-service'
     import { isAuthenticated, authTokens } from '$lib/auth/auth-store'

     export let data

     let letter: Letter | null = null
     let content = ''
     let title = ''
     let saving = false
     let loading = true
     let error = ''

     onMount(async () => {
       if (!$authTokens?.accessToken) {
         loading = false
         return
       }
       try {
         letter = await getLetter(data.date, $authTokens.accessToken)
         content = letter.content
         title = letter.title
       } catch (e) {
         error = 'Failed to load letter'
       }
       loading = false
     })

     async function handleSave(event: CustomEvent) {
       if (!$authTokens?.accessToken || !letter) return
       saving = true
       error = ''

       try {
         await updateLetter(letter.date, event.detail.content, event.detail.title, $authTokens.accessToken)
         goto(`/letters/${letter.date}`)
       } catch (e) {
         error = 'Failed to save changes'
         saving = false
       }
     }

     function handleCancel() {
       if (letter) goto(`/letters/${letter.date}`)
       else goto('/letters')
     }
   </script>

   {#if loading}
     <div class="container mx-auto p-4">
       <p>Loading...</p>
     </div>
   {:else if !$isAuthenticated}
     <div class="container mx-auto p-4">
       <p class="text-error">You must be logged in to edit letters.</p>
       <a href="/auth/login" class="btn btn-primary mt-4">Log In</a>
     </div>
   {:else if letter}
     <div class="container mx-auto p-4">
       <h1 class="text-2xl font-bold mb-4">Edit Letter</h1>

       {#if error}
         <div class="alert alert-error mb-4">{error}</div>
       {/if}

       <MarkdownEditor
         {content}
         {title}
         {saving}
         on:save={handleSave}
         on:cancel={handleCancel}
       />
     </div>
   {:else}
     <div class="container mx-auto p-4">
       <p class="text-error">{error || 'Letter not found'}</p>
       <a href="/letters" class="btn btn-link">Back to letters</a>
     </div>
   {/if}
   ```
3. Load letter content in onMount (requires auth token from store)
4. Handle authentication check
5. Display error messages
6. Redirect after save

**Verification Checklist:**
- [ ] Loads letter content into editor
- [ ] Requires authentication
- [ ] Saves changes via API
- [ ] Shows error on failure
- [ ] Redirects after save

**Testing Instructions:**
- Navigate to /letters/2016-02-10/edit when logged in
- Verify content loads in editor
- Make changes and save
- Verify redirected to detail page with changes

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(frontend): create letter edit page

- Load letter content into editor
- Require authentication for editing
- Save changes via API
```

---

### Task 6: Create Version History Component

**Goal:** Create a component to display version history with revert capability.

**Files to Create:**
- `frontend/lib/components/VersionHistory.svelte` - Version history UI

**Prerequisites:**
- Task 1 complete (service has getVersions, revertToVersion)

**Implementation Steps:**
1. Create version history component:
   ```svelte
   <script lang="ts">
     import { createEventDispatcher } from 'svelte'
     import type { LetterVersion } from '$lib/services/letters-service'

     export let versions: LetterVersion[] = []
     export let loading: boolean = false

     const dispatch = createEventDispatcher()

     function handleRevert(version: LetterVersion) {
       if (confirm(`Revert to version from ${formatDate(version.editedAt)}?`)) {
         dispatch('revert', { timestamp: version.timestamp })
       }
     }

     function formatDate(dateStr: string) {
       return new Date(dateStr).toLocaleString()
     }
   </script>

   <div class="bg-base-200 rounded-lg p-4">
     <h3 class="text-lg font-semibold mb-4">Version History</h3>

     {#if loading}
       <p class="text-gray-500">Loading versions...</p>
     {:else if versions.length === 0}
       <p class="text-gray-500">No previous versions</p>
     {:else}
       <ul class="space-y-2">
         {#each versions as version}
           <li class="flex justify-between items-center p-2 bg-base-100 rounded">
             <div>
               <span class="font-medium">Version {version.versionNumber}</span>
               <span class="text-sm text-gray-500 ml-2">
                 {formatDate(version.editedAt)}
               </span>
             </div>
             <button
               class="btn btn-sm btn-outline"
               on:click={() => handleRevert(version)}
             >
               Revert
             </button>
           </li>
         {/each}
       </ul>
     {/if}
   </div>
   ```
2. Display list of versions with timestamps
3. Confirm before revert
4. Dispatch revert event

**Verification Checklist:**
- [ ] Displays list of versions
- [ ] Shows version number and timestamp
- [ ] Confirmation dialog before revert
- [ ] Handles empty version list
- [ ] Revert event dispatched correctly

**Testing Instructions:**
- Import component in test page
- Pass mock versions array
- Click revert and verify event

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(frontend): create version history component

- Display list of letter versions
- Revert confirmation dialog
- Dispatch revert event
```

---

### Task 7: Integrate Version History into Letter Detail

**Goal:** Add version history component to the letter detail page.

**Files to Modify:**
- `frontend/routes/letters/[date]/+page.svelte` - Add version history

**Prerequisites:**
- Task 6 complete (version history component)
- Task 3 complete (detail page exists)

**Implementation Steps:**
1. Add version history to detail page:
   ```svelte
   <script lang="ts">
     // ... existing imports
     import VersionHistory from '$lib/components/VersionHistory.svelte'
     import { getVersions, revertToVersion } from '$lib/services/letters-service'

     let versions: LetterVersion[] = []
     let versionsLoading = true
     let showVersions = false

     onMount(async () => {
       if (letter?.versionCount > 0) {
         versions = await getVersions(letter.date)
       }
       versionsLoading = false
     })

     async function handleRevert(event: CustomEvent) {
       try {
         await revertToVersion(letter.date, event.detail.timestamp)
         // Reload letter
         letter = await getLetter(letter.date)
         versions = await getVersions(letter.date)
       } catch (e) {
         console.error('Failed to revert')
       }
     }
   </script>

   <!-- In the template, add toggle and component -->
   {#if $isAuthenticated && letter.versionCount > 0}
     <button
       class="btn btn-ghost btn-sm"
       on:click={() => showVersions = !showVersions}
     >
       {showVersions ? 'Hide' : 'Show'} Version History ({letter.versionCount})
     </button>

     {#if showVersions}
       <VersionHistory
         {versions}
         loading={versionsLoading}
         on:revert={handleRevert}
       />
     {/if}
   {/if}
   ```
2. Load versions on mount
3. Toggle visibility
4. Handle revert and refresh

**Verification Checklist:**
- [ ] Version history toggle visible when versions exist
- [ ] Versions load correctly
- [ ] Revert updates letter content
- [ ] Hidden for letters with no versions
- [ ] Only shown to authenticated users

**Testing Instructions:**
- View letter that has been edited
- Click "Show Version History"
- Verify versions displayed
- Test revert functionality

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(frontend): integrate version history into letter detail

- Add version history toggle
- Load versions on page mount
- Handle revert with content refresh
```

---

### Task 8: Remove Frontmatter Processing from Frontend

**Goal:** Remove frontmatter-related code that is no longer needed for letters.

**Files to Modify:**
- `frontend/lib/utils/posts.ts` - Remove letter-specific frontmatter logic
- `package.json` - Remove unused dependencies if applicable
- Any other files importing frontmatter utilities for letters

**Prerequisites:**
- Tasks 1-7 complete (new letter system functional)

**Implementation Steps:**
1. Identify all frontmatter usage:
   - `gray-matter` imports
   - `fff-flavored-frontmatter` usage
   - `posts.ts` letter-specific logic
2. Determine what to remove vs. keep:
   - Keep: Any frontmatter processing for non-letter content
   - Remove: Letter-specific frontmatter parsing
3. Remove or refactor code:
   - If frontmatter only used for letters: remove entirely
   - If used elsewhere: refactor to exclude letters
4. Update imports and dependencies
5. Test that non-letter functionality still works

**Verification Checklist:**
- [ ] No frontmatter parsing for letters
- [ ] Non-letter content still works (if applicable)
- [ ] No unused imports remain
- [ ] Build completes without errors
- [ ] Linting passes

**Testing Instructions:**
- Run `pnpm build` to verify no import errors
- Run `pnpm lint` to check for issues
- Test any non-letter markdown content still renders

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(frontend): remove frontmatter processing for letters

- Remove letter-specific frontmatter parsing
- Letters now fetch metadata from API
- Keep frontmatter for non-letter content if needed
```

---

### Task 9: Update Navigation and Remove Old Letter Routes

**Goal:** Update site navigation to use new letters routes and remove deprecated local file-based API routes.

**Files to Modify:**
- `frontend/lib/components/` - Navigation components
- Site configuration files as needed

**Files to Remove:**
- `frontend/routes/api/letters/+server.ts` - Old local file-based letter API
- `frontend/routes/api/letters/list/+server.ts` - Old S3-based letter listing

**Prerequisites:**
- Tasks 1-8 complete

**Implementation Steps:**
1. Update navigation to include `/letters` link:
   - Find main navigation component
   - Add "Letters" link pointing to `/letters`
   - Style consistently with other nav items
2. Remove deprecated API routes:
   - Delete `frontend/routes/api/letters/+server.ts` (reads from local filesystem)
   - Delete `frontend/routes/api/letters/list/+server.ts` (reads from S3 urara/ prefix)
   - These are replaced by the API Gateway endpoints defined in Phase 2
3. Update home page if it references old letter structure
4. Test navigation flow

**Verification Checklist:**
- [ ] Letters link in main navigation
- [ ] `frontend/routes/api/letters/` directory removed
- [ ] No broken links
- [ ] Navigation works on all pages

**Testing Instructions:**
- Navigate entire site
- Verify letters link works
- Verify `/api/letters` endpoint no longer exists (should 404)
- Verify new `/letters` page route works

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(frontend): update navigation and remove deprecated letter APIs

- Add letters link to main navigation
- Remove deprecated local file-based letter API routes
- Letters now served via API Gateway endpoints
```

---

### Task 10: Clean Up Urara.js for Non-Letter Usage

**Goal:** Modify or remove urara.js file watcher to exclude letters (which are now dynamic).

**Files to Modify:**
- `urara.js` - Build/watch script
- `package.json` - Update scripts if needed

**Prerequisites:**
- Task 9 complete (new system fully functional)

**Implementation Steps:**
1. Analyze current urara.js usage:
   - Currently watches `/urara` folder
   - Copies to `/frontend/routes`
   - Used for static site generation
2. Determine if urara.js needed for non-letter content:
   - If YES: Modify to exclude letters, keep for other content
   - If NO: Remove or disable
3. Update package.json scripts:
   - Modify `urara:build` and `urara:watch` if keeping
   - Remove if not needed
4. Document any changes

**Verification Checklist:**
- [ ] Letters not processed by urara.js
- [ ] Non-letter content still works (if applicable)
- [ ] Build scripts updated
- [ ] Documentation updated

**Testing Instructions:**
- Run `pnpm dev` and verify no letter processing
- Run `pnpm build` and verify successful
- Check no duplicate content generation

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor: update urara.js to exclude letters

- Letters now served dynamically from API
- Remove letter processing from build script
- Keep functionality for non-letter content if needed
```

---

## Phase Verification

After completing all tasks in Phase 3:

1. **Frontend Build:**
   ```bash
   pnpm build
   ```
   - Build completes without errors
   - No missing imports

2. **Lint Check:**
   ```bash
   pnpm lint
   ```
   - No linting errors

3. **Type Check:**
   ```bash
   pnpm check
   ```
   - No TypeScript errors

4. **Manual Testing Checklist:**
   - [ ] Navigate to /letters - see list of letters
   - [ ] Click letter - see content rendered
   - [ ] Download PDF - opens in new tab
   - [ ] Click Edit (when logged in) - editor opens
   - [ ] Make edit and save - returns to detail with changes
   - [ ] View version history - see previous versions
   - [ ] Revert to version - content updates
   - [ ] Navigation links work throughout site

5. **End-to-End Flow:**
   ```
   1. Go to /letters
   2. Click on a letter (e.g., 2016-02-10)
   3. View content, download PDF
   4. Log in if not already
   5. Click Edit
   6. Make a change in editor
   7. Verify preview updates
   8. Save
   9. View updated content
   10. Show version history
   11. Revert to previous version
   12. Verify content reverted
   ```

## Known Limitations

- No offline support for letter viewing
- No autosave in editor (only manual save)
- Version history UI is simple (no diff view)
- Search not implemented

## Technical Debt

- Consider adding autosave with debounce
- Could add keyboard shortcuts for editor
- May want to add loading skeletons for better UX
- Could implement optimistic updates for faster perceived performance
