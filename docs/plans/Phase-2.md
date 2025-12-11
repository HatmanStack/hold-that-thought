# Phase 2: Frontend Implementation

## Phase Goal
Build the user interface for uploading letters, viewing the draft queue, and reviewing/publishing processed letters.

## Prerequisites
*   Phase 1 completed (Backend API functional).
*   Access to the deployed API URL.

## Tasks

### Task 1: Upload Interface
**Goal:** Create a UI to select files (images or PDF) and initiate the upload process.

**Files to Modify/Create:**
*   `frontend/lib/components/letters/LetterUploader.svelte`: New component.
*   `frontend/lib/services/letter-upload-service.ts`: Service to handle S3 uploads.
*   `frontend/routes/admin/letters/upload/+page.svelte`: New admin route (or modal).

**Implementation Steps:**
1.  **UI Component:**
    *   File input (accepts `.pdf, .jpg, .png`).
    *   Allow multiple file selection.
    *   Display selected files list.
2.  **Service Logic:**
    *   Call `POST /letters/upload-request` to get presigned URLs.
    *   Upload files to S3 using `fetch` (PUT).
    *   Call `POST /letters/process/{uploadId}`.
3.  **Feedback:**
    *   Show progress bars for uploads.
    *   Show "Processing..." state after triggering backend.
    *   Redirect to Drafts list on success.

**Verification Checklist:**
*   [x] Can select multiple images.
*   [x] Files are successfully uploaded to S3 (check Network tab).
*   [x] "Processing" toast/notification appears.

---

### Task 2: Drafts Dashboard
**Goal:** List all pending drafts waiting for review.

**Files to Modify/Create:**
*   `frontend/routes/admin/letters/drafts/+page.svelte`: Dashboard page.
*   `frontend/lib/services/draft-service.ts`: API client for drafts.

**Implementation Steps:**
1.  Fetch drafts using `GET /admin/drafts`.
2.  Display table/grid:
    *   Draft ID / Date Created.
    *   Status (Processing/Ready/Error).
    *   Parsed Summary (Title/Date if available).
3.  Add "Review" button for each draft.

**Verification Checklist:**
*   [x] Displays list of drafts from backend.
*   [x] Handles empty state.

---

### Task 3: Review & Publish Modal
**Goal:** A split-screen interface to view the original PDF and edit the parsed data before publishing.

**Files to Modify/Create:**
*   `frontend/lib/components/letters/DraftReviewModal.svelte`: Complex modal.
*   `frontend/routes/admin/letters/drafts/[id]/+page.svelte`: Review page (alternative to modal).

**Implementation Steps:**
1.  **Layout:**
    *   Left column: PDF Viewer (iframe pointing to presigned URL of `combined.pdf` or images).
    *   Right column: Form fields (Date, Title, Author, Tags, Markdown Body).
2.  **Data Binding:**
    *   Pre-fill form with `draft.parsedData`.
3.  **Actions:**
    *   "Save Changes" (Updates draft in DB - optional intermediate save).
    *   "Publish" (Calls `POST /publish`).
    *   "Discard" (Deletes draft).
4.  **Publishing:**
    *   On success, redirect to the main Letters list.

**Verification Checklist:**
*   [x] PDF loads in viewer.
*   [x] Form pre-fills with Gemini data.
*   [x] Publishing removes item from Drafts and adds to Letters.

---

## Phase Verification
*   Complete an end-to-end "Upload -> Review -> Publish" flow in the browser.
*   Verify the published letter appears correctly in the public `/letters` route.

**Commit Message Template**
```text
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

feat(frontend): [task description]

[Detailed explanation]
```
