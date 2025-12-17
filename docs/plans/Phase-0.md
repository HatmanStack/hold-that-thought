# Phase 0: Foundation

## Architecture Decisions

### ADR-001: Store Relationships as Array on User Profile

**Context:** We need to store family relationships for each user. Options include:
1. Separate DynamoDB items per relationship
2. Array field on the existing user profile record
3. Separate relationships table

**Decision:** Store relationships as a JSON array field (`familyRelationships`) on the existing `USER_PROFILE` entity.

**Rationale:**
- Relationships are always accessed with the profile (no need for separate queries)
- Expected volume is small (soft limit at 10, rarely more than 20)
- Simpler data model - no additional key patterns needed
- Single atomic update when saving profile changes
- Follows existing pattern (profile already has arrays like notification settings)

**Consequences:**
- Maximum item size in DynamoDB is 400KB - relationships array won't approach this
- All relationships loaded with profile (acceptable given small size)

---

### ADR-002: Hybrid Relationship Types (Predefined + Custom)

**Context:** Users need to specify relationship types. Options include:
1. Completely freeform text
2. Strict predefined list only
3. Predefined list with "Other" option for custom entries

**Decision:** Use predefined relationship types with an "Other" option for custom entries.

**Rationale:**
- Predefined types give consistency for common relationships
- "Other" allows flexibility for edge cases (e.g., "Mom's cousin", "Family friend")
- Better UX than pure freeform (dropdown faster than typing)
- Still allows personalized terminology via custom option

**Predefined Types:**
- Immediate: Mother, Father, Sibling, Spouse/Partner, Child
- Grandparents: Grandmother (maternal), Grandfather (maternal), Grandmother (paternal), Grandfather (paternal)
- Extended: Aunt, Uncle, Cousin, Niece, Nephew
- Great-grandparents: Great-grandmother (maternal), Great-grandfather (maternal), Great-grandmother (paternal), Great-grandfather (paternal)
- Custom: Other (freeform text)

---

### ADR-003: Soft Limit with Warning at 10 Relationships

**Context:** Need to balance user flexibility with LLM context quality.

**Decision:** Show a warning when users exceed 10 relationships, but allow them to continue adding more.

**Rationale:**
- More relationships = more context tokens = potential degradation of chat responses
- Hard limits frustrate users with large families
- Warning educates without blocking
- 10 covers most immediate family needs

---

## Data Model

### FamilyRelationship Type

```typescript
interface FamilyRelationship {
  id: string           // UUID for stable identification
  type: string         // Predefined type or "Other"
  customType?: string  // Only used when type === "Other"
  name: string         // Person's name as it appears in archive
  createdAt: string    // ISO timestamp
}
```

### Updated UserProfile Type

```typescript
interface UserProfile {
  // ... existing fields ...
  familyRelationships?: FamilyRelationship[]
}
```

### DynamoDB Storage

The `familyRelationships` array is stored directly on the user profile item:

```json
{
  "PK": "USER#<userId>",
  "SK": "PROFILE",
  "entityType": "USER_PROFILE",
  "familyRelationships": [
    {
      "id": "uuid-1",
      "type": "Grandmother (maternal)",
      "name": "Mary Smith",
      "createdAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "type": "Other",
      "customType": "Mom's cousin",
      "name": "Bob Jones",
      "createdAt": "2025-01-15T10:01:00.000Z"
    }
  ]
}
```

---

## Tech Stack

### Frontend
- **Framework:** Svelte 4 with TypeScript
- **UI Components:** DaisyUI (Tailwind-based)
- **State:** Svelte stores (existing `authStore` pattern)
- **Routing:** SvelteKit file-based routing

### Backend
- **Runtime:** Node.js 24.x on AWS Lambda
- **Database:** DynamoDB (single-table design)
- **API:** API Gateway REST API (existing)
- **Infrastructure:** AWS SAM

### Testing
- **Unit Tests:** Vitest with aws-sdk-client-mock
- **Integration Tests:** Vitest with mocked AWS services
- **E2E Tests:** Playwright (existing setup)

---

## Shared Patterns and Conventions

### Frontend Service Pattern

All API calls follow the existing pattern in `profile-service.ts`:

```typescript
export async function updateFamilyRelationships(
  relationships: FamilyRelationship[]
): Promise<ProfileApiResponse> {
  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ familyRelationships: relationships }),
    })
    // ... error handling
  } catch (error) {
    // ... error handling
  }
}
```

### Backend Route Handler Pattern

Follow the existing profile route patterns in `profile.js`:

```javascript
// Add to allowedFields array in updateProfile
const allowedFields = [
  // ... existing fields ...
  'familyRelationships'
]

// Add validation for familyRelationships
if (body.familyRelationships) {
  // Validate array structure
  // Sanitize text fields
}
```

### Component Pattern

New UI sections follow the existing profile settings structure:
- DaisyUI form controls
- Dividers between sections
- Consistent label styling
- Error/success message handling

---

## Testing Strategy

### Unit Tests (CI-Safe)

All unit tests must run without live AWS resources:

1. **Backend Handler Tests** (`tests/unit/profile-handler.test.js`)
   - Mock DynamoDB with `aws-sdk-client-mock`
   - Test CRUD operations for relationships
   - Test validation (array structure, name sanitization)
   - Test soft limit warning threshold

2. **Frontend Service Tests** (if added)
   - Mock fetch calls
   - Test request/response handling

### Integration Tests (CI-Safe)

Integration tests use mocked AWS services:

1. **Profile API Integration** (`tests/integration/profile.test.js`)
   - Full request/response cycle
   - Authentication flow with mocked tokens
   - Error scenarios

### Test File Locations

```
tests/
├── unit/
│   └── profile-handler.test.js  # Add relationship tests here
└── integration/
    └── profile.test.js          # Add relationship integration tests
```

### Running Tests

```bash
# From project root
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- profile        # Run only profile tests
```

---

## Deployment

### Local Development

No changes to existing development workflow:

```bash
# Frontend
cd frontend && npm run dev

# Backend (if testing locally)
cd backend && sam local start-api
```

### Deployment Script

Use existing deployment workflow:

```bash
cd backend
sam build
sam deploy --stack-name hold-test --no-confirm-changeset
```

**Note:** This feature requires no infrastructure changes - only Lambda code updates. The DynamoDB table schema is flexible (no new indexes needed).

---

## File Change Summary

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/lib/types/profile.ts` | Modify | Add FamilyRelationship interface |
| `frontend/lib/services/profile-service.ts` | Modify | Update to handle relationships |
| `frontend/routes/profile/settings/+page.svelte` | Modify | Add relationships UI section |
| `backend/lambdas/api/routes/profile.js` | Modify | Handle relationships in update |
| `tests/unit/profile-handler.test.js` | Modify | Add relationship tests |

### No New Files Required

This feature extends existing files rather than creating new ones, following the YAGNI principle.
