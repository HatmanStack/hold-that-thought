# Backend Authorization Implementation

This document explains how the backend authorization system works to ensure only users in the `ApprovedUsers` Cognito group can access protected resources.

## Overview

The authorization system consists of three main components:

1. **Cognito User Pool Group**: `ApprovedUsers` group in AWS Cognito
2. **JWT Token Validation**: Server-side verification of Cognito JWT tokens
3. **Group Authorization**: Checking the `cognito:groups` claim in JWT tokens

## Architecture

```
Client Request → JWT Token → Server Validation → Group Check → Access Granted/Denied
```

## Implementation Details

### 1. Cognito User Pool Configuration

The `ApprovedUsers` group is defined in `aws-infrastructure/cognito-user-pool.yaml`:

```yaml
ApprovedUsersGroup:
  Type: AWS::Cognito::UserPoolGroup
  Properties:
    GroupName: ApprovedUsers
    Description: 'Group for users with approved access to the application'
    UserPoolId: !Ref UserPool
    Precedence: 1
```

### 2. JWT Token Validation (`src/lib/auth/jwt.ts`)

- Uses the `jose` library for secure JWT verification
- Validates tokens against Cognito's public keys (JWKS)
- Extracts user information and group memberships from token payload

Key functions:
- `verifyJWT(token)`: Verifies and decodes JWT tokens
- `isUserApproved(payload)`: Checks if user belongs to ApprovedUsers group
- `extractTokenFromHeader(authHeader)`: Extracts Bearer token from Authorization header

### 3. Authorization Middleware (`src/lib/auth/middleware.ts`)

Provides reusable functions for protecting routes and API endpoints:

- `requireApprovedUser(event)`: Throws 401/403 errors if user is not authenticated or approved
- `getOptionalUser(event)`: Returns user info if authenticated, null otherwise
- `isAuthenticated(event)`: Simple authentication check without group validation

### 4. SvelteKit Integration

#### Server Hooks (`src/hooks.server.ts`)
Adds user context to all requests:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await getOptionalUser(event)
  // ... rest of handler
}
```

#### Protected Pages
Use `requireApprovedUser()` in page server load functions:

```typescript
// src/routes/admin/+page.server.ts
export const load: PageServerLoad = async (event) => {
  const user = await requireApprovedUser(event)
  return { user }
}
```

#### Protected API Routes
Use `requireApprovedUser()` in API route handlers:

```typescript
// src/routes/api/protected/+server.ts
export const GET: RequestHandler = async (event) => {
  const user = await requireApprovedUser(event)
  return json({ message: 'Protected data', user })
}
```

## Usage Examples

### 1. Protecting a Page

```typescript
// src/routes/admin/+page.server.ts
import type { PageServerLoad } from './$types'
import { requireApprovedUser } from '$lib/auth/middleware'

export const load: PageServerLoad = async (event) => {
  const user = await requireApprovedUser(event)
  return { user }
}
```

### 2. Protecting an API Endpoint

```typescript
// src/routes/api/admin/users/+server.ts
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireApprovedUser } from '$lib/auth/middleware'

export const GET: RequestHandler = async (event) => {
  const user = await requireApprovedUser(event)
  
  // Your protected logic here
  const data = await getAdminData()
  
  return json({ data, user: user.email })
}
```

### 3. Optional Authentication

```typescript
// src/routes/api/public/+server.ts
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getOptionalUser } from '$lib/auth/middleware'

export const GET: RequestHandler = async (event) => {
  const user = await getOptionalUser(event)
  
  return json({
    message: 'Public endpoint',
    isAuthenticated: !!user,
    userEmail: user?.email || null
  })
}
```

## Client-Side Integration

### Making Authenticated Requests

```typescript
import { authenticatedFetch } from '$lib/auth/client'

// This automatically adds the Authorization header
const response = await authenticatedFetch('/api/protected')
const data = await response.json()
```

### Checking User Status

```typescript
import { getUserInfo, isUserApproved } from '$lib/auth/client'

const userInfo = getUserInfo()
const isApproved = isUserApproved()

if (isApproved) {
  // User can access protected features
}
```

## Error Handling

The system returns standardized error responses:

### 401 Unauthorized
```json
{
  "message": "Authentication required",
  "code": "MISSING_TOKEN"
}
```

```json
{
  "message": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}
```

### 403 Forbidden
```json
{
  "message": "Access denied. User is not in the ApprovedUsers group.",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

## Security Considerations

1. **JWT Verification**: All tokens are cryptographically verified using Cognito's public keys
2. **Group Claims**: The `cognito:groups` claim is trusted because it comes from a verified JWT
3. **Token Expiration**: Tokens have configurable expiration times (default: 60 minutes)
4. **HTTPS Only**: All authentication should happen over HTTPS in production
5. **Token Storage**: Client-side tokens are stored in localStorage (consider httpOnly cookies for enhanced security)

## Adding Users to ApprovedUsers Group

### Via AWS Console
1. Go to AWS Cognito User Pools
2. Select your user pool
3. Go to "Users and groups" → "Groups"
4. Select "ApprovedUsers" group
5. Click "Add users" and select the users to approve

### Via AWS CLI
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_xxxxxxxxx \
  --username user@example.com \
  --group-name ApprovedUsers
```

### Programmatically
```typescript
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({ region: 'us-east-1' })

await client.send(new AdminAddUserToGroupCommand({
  UserPoolId: 'us-east-1_xxxxxxxxx',
  Username: 'user@example.com',
  GroupName: 'ApprovedUsers'
}))
```

## Testing

### Test Protected Endpoint
```bash
# Without token (should return 401)
curl https://your-app.com/api/protected

# With valid token from approved user (should return 200)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" https://your-app.com/api/protected

# With valid token from non-approved user (should return 403)
curl -H "Authorization: Bearer NON_APPROVED_JWT_TOKEN" https://your-app.com/api/protected
```

### Test Admin Page
- Visit `/admin` without authentication → Should redirect to error page
- Visit `/admin` with approved user → Should show admin dashboard
- Visit `/admin` with non-approved user → Should show 403 error

## Troubleshooting

### Common Issues

1. **"JWT verification failed"**
   - Check that `PUBLIC_COGNITO_USER_POOL_ID` and `PUBLIC_AWS_REGION` are correct
   - Ensure the token hasn't expired
   - Verify the token is a valid Cognito JWT

2. **"User is not in the ApprovedUsers group"**
   - Check that the user has been added to the ApprovedUsers group in Cognito
   - Verify the group name is exactly "ApprovedUsers" (case-sensitive)

3. **"Missing token"**
   - Ensure the client is sending the Authorization header
   - Check that the token is prefixed with "Bearer "

### Debug Mode

Add logging to see token contents:

```typescript
// In your middleware
console.log('JWT Payload:', payload)
console.log('User Groups:', payload['cognito:groups'])
```

## Migration Notes

If you have existing users who should be approved:

1. Create a script to add all existing users to the ApprovedUsers group
2. Or implement a temporary bypass during migration
3. Communicate the change to users before deployment

This ensures a smooth transition to the new authorization system.