# Phase 1: Family Relationships Implementation

## Phase Goal

Implement the complete Family Relationships feature, allowing users to define and manage their relationships to people in the family archive. This includes TypeScript types, backend API support, frontend UI in profile settings, and comprehensive test coverage.

**Success Criteria:**
- Users can add, edit, and remove family relationships from their profile settings
- Relationships persist in DynamoDB and load correctly on page refresh
- Soft limit warning appears when exceeding 10 relationships
- Helper text explains the feature's purpose for chat context
- All unit tests pass in CI environment
- Backend validates and sanitizes relationship data

**Estimated Tokens:** ~50,000

---

## Prerequisites

- Phase 0 completed (architecture decisions understood)
- Development environment set up (Node.js 24, AWS CLI, SAM CLI)
- Access to the codebase and ability to run tests locally

---

## Tasks

### Task 1: Add TypeScript Types for Family Relationships

**Goal:** Define the TypeScript interfaces for family relationships to ensure type safety across frontend code.

**Files to Modify/Create:**
- `frontend/lib/types/profile.ts` - Add FamilyRelationship interface and update UserProfile

**Prerequisites:**
- None (this is the foundation for other tasks)

**Implementation Steps:**

1. Open `frontend/lib/types/profile.ts`

2. Add a new `FamilyRelationship` interface before the `UserProfile` interface:
   - `id`: string (UUID for stable identification during editing)
   - `type`: string (the relationship type from predefined list or "Other")
   - `customType`: optional string (used only when type is "Other")
   - `name`: string (the person's name as it appears in the archive)
   - `createdAt`: string (ISO timestamp)

3. Update the `UserProfile` interface:
   - Add `familyRelationships?: FamilyRelationship[]` field

4. Update the `UpdateProfileRequest` interface:
   - Add `familyRelationships?: FamilyRelationship[]` field

5. Export a constant array of predefined relationship types for use in the UI dropdown:
   - Group by category (Immediate, Grandparents, Extended, Great-grandparents)
   - Include "Other" as the final option

**Verification Checklist:**
- [x] `FamilyRelationship` interface is exported
- [x] `UserProfile` includes optional `familyRelationships` array
- [x] `UpdateProfileRequest` includes optional `familyRelationships` array
- [x] `RELATIONSHIP_TYPES` constant is exported with all predefined types
- [x] TypeScript compilation succeeds (`pnpm check` or `npm run check`)

**Testing Instructions:**
- No unit tests needed for types
- Verify compilation: `cd frontend && pnpm check`

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(types): add FamilyRelationship interface and predefined types

Add TypeScript types for family relationships feature
Export RELATIONSHIP_TYPES constant for UI dropdown
```

---

### Task 2: Update Backend Profile Handler

**Goal:** Modify the backend to accept, validate, store, and return family relationships as part of the user profile.

**Files to Modify/Create:**
- `backend/lambdas/api/routes/profile.js` - Handle familyRelationships in profile updates and reads

**Prerequisites:**
- Task 1 completed (types defined)

**Implementation Steps:**

1. Open `backend/lambdas/api/routes/profile.js`

2. In the `updateProfile` function, add `familyRelationships` to the `allowedFields` array

3. Add validation logic for `familyRelationships` before the update:
   - Verify it's an array (if provided)
   - Validate each relationship has required fields (`id`, `type`, `name`)
   - Sanitize `name` and `customType` fields using existing `sanitizeText` function
   - Limit name to 200 characters
   - Limit customType to 100 characters
   - Ensure `type` is a non-empty string
   - Generate `createdAt` if missing

4. In the `getProfile` function, add `familyRelationships` to the response object:
   - Return `profile.familyRelationships || []`

5. In the new profile creation block (when profile doesn't exist), initialize:
   - `familyRelationships: body.familyRelationships || []`

**Verification Checklist:**
- [x] `familyRelationships` included in `allowedFields` array
- [x] Validation rejects invalid relationship structures
- [x] Text fields are sanitized (XSS prevention)
- [x] `getProfile` returns `familyRelationships` array
- [x] New profile creation includes `familyRelationships`
- [x] Backend builds successfully (`cd backend && sam build`)

**Testing Instructions:**

Add tests to `tests/unit/profile-handler.test.js`:

1. Test: "should save family relationships with profile update"
   - Mock existing profile
   - Send PUT with `familyRelationships` array
   - Verify UpdateCommand includes relationships

2. Test: "should return family relationships in profile response"
   - Mock profile with relationships
   - GET profile
   - Verify response includes relationships array

3. Test: "should validate relationship structure"
   - Send malformed relationships (missing fields)
   - Expect 400 error

4. Test: "should sanitize relationship names"
   - Send relationship with XSS payload in name
   - Verify sanitization in UpdateCommand

Run tests: `npm test -- profile-handler`

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(api): add family relationships to profile handler

Support CRUD operations for familyRelationships array
Add validation for relationship structure
Sanitize name and customType fields
```

---

### Task 3: Update Frontend Profile Service

**Goal:** Ensure the frontend profile service correctly handles the new familyRelationships field in API requests and responses.

**Files to Modify/Create:**
- `frontend/lib/services/profile-service.ts` - No changes needed (generic handling works)

**Prerequisites:**
- Task 1 completed (types defined)
- Task 2 completed (backend accepts relationships)

**Implementation Steps:**

1. Review `frontend/lib/services/profile-service.ts`

2. The existing `updateProfile` function already accepts `UpdateProfileRequest` and passes it to the API. Since we added `familyRelationships` to `UpdateProfileRequest` in Task 1, no code changes are needed.

3. Verify that `getProfile` return type correctly maps to `UserProfile` which now includes `familyRelationships`

**Note:** This task may require no code changes if the existing generic handling is sufficient. The main work is verification.

**Verification Checklist:**
- [x] `updateProfile` accepts objects with `familyRelationships`
- [x] Response types include `familyRelationships`
- [x] No TypeScript errors when using relationships

**Testing Instructions:**
- Manual verification via TypeScript compilation
- Integration testing happens in Task 5

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(frontend): verify profile service handles family relationships

No code changes needed - generic UpdateProfileRequest handling works
```

---

### Task 4: Implement Profile Settings UI for Family Relationships

**Goal:** Add a "My Family Relationships" section to the profile settings page where users can manage their relationships.

**Files to Modify/Create:**
- `frontend/routes/profile/settings/+page.svelte` - Add relationships management UI

**Prerequisites:**
- Task 1 completed (types and constants available)
- Task 2 completed (backend ready)

**Implementation Steps:**

1. Open `frontend/routes/profile/settings/+page.svelte`

2. Import the necessary types and constants:
   - Import `FamilyRelationship` type
   - Import `RELATIONSHIP_TYPES` constant

3. Add state variables for relationships management:
   - `let familyRelationships: FamilyRelationship[] = []`
   - Track editing state for inline edits

4. In the `loadProfile` function, populate relationships:
   - `familyRelationships = profile.familyRelationships || []`

5. Create helper functions:
   - `addRelationship()` - Add new empty relationship to array
   - `removeRelationship(id)` - Remove relationship by ID
   - `generateId()` - Generate UUID for new relationships

6. In the `handleSave` function, include relationships in the update:
   - Add `familyRelationships` to the `updateProfile` call

7. Add UI section after the "Family Information" divider (before "Notifications"):

   a. Section header with helper text:
      - Title: "My Family Relationships"
      - Helper text explaining this helps the chat understand context

   b. Warning alert (shown when relationships.length > 10):
      - Yellow/warning style
      - Message about potential impact on chat quality

   c. Relationship list:
      - For each relationship, show:
        - Dropdown for relationship type (using RELATIONSHIP_TYPES)
        - Text input for custom type (shown only when type === "Other")
        - Text input for person's name
        - Delete button (X icon)
      - Use DaisyUI form controls matching existing style

   d. "Add Relationship" button:
      - Adds new empty relationship to the list
      - Style: `btn btn-outline btn-sm`

8. Style considerations:
   - Match existing section patterns (dividers, spacing)
   - Use responsive grid for relationship fields
   - Disable inputs during save operation

**Verification Checklist:**
- [x] Relationships section appears in profile settings
- [x] Helper text explains purpose for chat context
- [x] Dropdown shows all predefined relationship types
- [x] Custom type input appears only when "Other" selected
- [x] Can add new relationships
- [x] Can remove relationships
- [x] Warning appears when > 10 relationships
- [x] Relationships save correctly
- [x] Relationships load on page refresh
- [x] UI disabled during save operation

**Testing Instructions:**

Manual testing:
1. Navigate to `/profile/settings`
2. Scroll to "My Family Relationships" section
3. Add a relationship with predefined type
4. Add a relationship with "Other" type
5. Save and verify persistence
6. Reload page and verify data loads
7. Add 11 relationships and verify warning appears
8. Remove a relationship and save

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(ui): add family relationships section to profile settings

Add management UI for defining family relationships
Include helper text about chat context benefits
Show warning when exceeding 10 relationships
```

---

### Task 5: Add Comprehensive Unit Tests

**Goal:** Ensure robust test coverage for the family relationships feature, with all tests passing in CI (no live AWS resources).

**Files to Modify/Create:**
- `tests/unit/profile-handler.test.js` - Add relationship-specific tests

**Prerequisites:**
- Task 2 completed (backend implementation)

**Implementation Steps:**

1. Open `tests/unit/profile-handler.test.js`

2. Add a new describe block: `describe('family relationships', () => { ... })`

3. Implement the following test cases:

   **Basic CRUD:**
   - "should save family relationships with profile update"
   - "should return empty array when no relationships exist"
   - "should return family relationships in profile response"
   - "should update existing relationships"
   - "should handle profile creation with relationships"

   **Validation:**
   - "should reject relationships missing required fields"
   - "should reject relationships with invalid structure (not an array)"
   - "should accept empty relationships array"

   **Sanitization:**
   - "should sanitize relationship name for XSS"
   - "should sanitize customType for XSS"
   - "should truncate long names"

4. Use existing test patterns:
   - Mock DynamoDB with `ddbMock`
   - Use `mockProfile` helper
   - Assert on response status and body

**Verification Checklist:**
- [x] All new tests pass locally
- [x] Tests use mocked DynamoDB (no live AWS)
- [x] Edge cases covered (empty array, missing fields)
- [x] XSS sanitization verified
- [x] Test names are descriptive

**Testing Instructions:**
```bash
# Run all profile tests
npm test -- profile-handler

# Run with verbose output
npm test -- profile-handler --reporter=verbose
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

test(profile): add family relationships unit tests

Add comprehensive tests for relationship CRUD operations
Test validation and sanitization of relationship data
All tests use mocked DynamoDB for CI compatibility
```

---

### Task 6: Deploy and Verify

**Goal:** Deploy the feature to the development environment and perform end-to-end verification.

**Files to Modify/Create:**
- None (deployment only)

**Prerequisites:**
- All previous tasks completed
- All tests passing

**Implementation Steps:**

1. Build the backend:
   ```bash
   cd backend
   sam build
   ```

2. Deploy to the development stack:
   ```bash
   sam deploy --stack-name hold-test --no-confirm-changeset
   ```

3. Verify frontend builds without errors:
   ```bash
   cd frontend
   pnpm build
   ```

4. Test the feature end-to-end:
   - Log in to the application
   - Navigate to profile settings
   - Add several family relationships
   - Save and verify persistence
   - Check browser console for errors

**Verification Checklist:**
- [x] Backend deploys successfully
- [x] Frontend builds without errors
- [ ] Feature works end-to-end in browser (requires manual testing)
- [ ] No console errors (requires manual testing)
- [ ] Relationships persist across sessions (requires manual testing)

**Testing Instructions:**

End-to-end manual testing:
1. Deploy backend
2. Start frontend dev server
3. Log in as test user
4. Navigate to `/profile/settings`
5. Add relationships:
   - "Grandmother (maternal)" → "Mary Smith"
   - "Other" / "Mom's cousin" → "Bob Jones"
6. Save profile
7. Refresh page - verify relationships load
8. Add 11 relationships - verify warning appears
9. Remove a relationship - verify it saves

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(deploy): deploy family relationships feature

Deploy backend Lambda with relationship support
Verify end-to-end functionality
```

---

## Phase Verification

### All Tests Pass
```bash
# From project root
npm test
```

Expected: All tests pass, including new relationship tests.

### Linting Passes
```bash
cd frontend && pnpm lint
```

Expected: No linting errors.

### Build Succeeds
```bash
cd backend && sam build
cd frontend && pnpm build
```

Expected: Both build without errors.

### Feature Works End-to-End
1. Can add family relationships in profile settings
2. Helper text is visible explaining chat context
3. Warning appears at > 10 relationships
4. Relationships persist after save/reload
5. Can edit and remove relationships

---

## Known Limitations

1. **No relationship validation against archive:** The system doesn't verify that the named person exists in the archive. Users can type any name.

2. **No duplicate detection:** Users could add the same relationship twice. This is acceptable - they might have two grandmothers with the same name from different sides.

3. **Context injection not implemented:** This phase only stores relationships. The chat context injection (using relationships in LLM prompts) is a separate feature.

---

## Technical Debt

None introduced. This implementation follows existing patterns and doesn't add complexity that needs future cleanup.
