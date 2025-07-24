# AWS Cognito Authentication Setup Guide

This guide walks you through setting up AWS Cognito authentication with Google OAuth and manual user management for your SvelteKit application.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SvelteKit     │    │   API Gateway    │    │     Lambda      │
│   Frontend      │◄──►│  + JWT Auth      │◄──►│   Functions     │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  AWS Cognito    │    │   CloudWatch     │
│ User Pool +     │    │     Logs         │
│ Google OAuth    │    │                  │
└─────────────────┘    └──────────────────┘
```

## Features

- ✅ **Google OAuth Integration** - Sign in with Google accounts
- ✅ **AWS Cognito Hosted UI** - Pre-built authentication pages
- ✅ **Manual User Management** - Add users directly via AWS Console
- ✅ **JWT Token Validation** - Secure API Gateway authorization
- ✅ **Automatic Token Refresh** - Seamless session management
- ✅ **Protected Routes** - Client-side route protection
- ✅ **Multiple Auth Methods** - Google OAuth, Hosted UI, and manual login
- ✅ **CORS-enabled API Gateway** - Ready for production
- ✅ **Infrastructure as Code** - CloudFormation templates

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js** 18+ and npm/pnpm
3. **AWS Account** with permissions to create:
   - Cognito User Pools
   - API Gateway
   - Lambda Functions
   - IAM Roles
   - CloudFormation Stacks

## Quick Start

### 1. Deploy AWS Infrastructure

```bash
# Make the deployment script executable
chmod +x scripts/deploy-auth-infrastructure.sh

# Deploy without Google OAuth (can be added later)
./scripts/deploy-auth-infrastructure.sh dev my-app

# Deploy with Google OAuth (requires Google Cloud setup first)
./scripts/deploy-auth-infrastructure.sh dev my-app YOUR_GOOGLE_CLIENT_ID YOUR_GOOGLE_CLIENT_SECRET

# Or deploy to production
./scripts/deploy-auth-infrastructure.sh prod my-app
```

This script will:
- Create Cognito User Pool with Google OAuth support
- Set up Cognito Hosted UI for authentication
- Configure API Gateway with JWT authorization
- Deploy example Lambda function
- Generate `.env` file with all configuration

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Start Development Server

```bash
npm run dev
# or
pnpm dev
```

### 4. Test Authentication

**Option A: Google OAuth (Recommended)**
1. Visit `http://localhost:5173/auth/login`
2. Click "Continue with Google"
3. Sign in with your Google account
4. Visit `/dashboard` to see protected content

**Option B: Hosted UI**
1. Visit `http://localhost:5173/auth/login`
2. Click "Sign In with Hosted UI"
3. Use the AWS Cognito hosted authentication page
4. Visit `/dashboard` to see protected content

**Option C: Manual User (Admin Created)**
1. Add user via AWS Console (see Manual User Management section)
2. Visit `http://localhost:5173/auth/login`
3. Click "Sign in with Email & Password"
4. Use the credentials you set in AWS Console

> **Note:** Self-registration is disabled. Only Google OAuth users and manually added users can access the application.

## Google OAuth Setup (Optional)

To enable Google OAuth, you need to set up a Google Cloud project first:

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure the OAuth consent screen if prompted
6. Set **Application type** to **Web application**
7. Add **Authorized redirect URIs**:
   ```
   http://localhost:5173/auth/callback
   https://your-domain.com/auth/callback
   ```
8. Save and copy the **Client ID** and **Client Secret**

### 2. Deploy with Google OAuth

```bash
./scripts/deploy-auth-infrastructure.sh dev my-app YOUR_CLIENT_ID YOUR_CLIENT_SECRET
```

## Manual User Management

You can add users directly through the AWS Console without requiring self-registration:

### Adding Users via AWS Console

1. Go to **AWS Console** → **Cognito** → **User Pools**
2. Select your user pool (e.g., `my-app-dev-user-pool`)
3. Click **Users** tab → **Create user**
4. Fill in the details:
   - **Username**: User's email address
   - **Email**: Same as username
   - **Temporary password**: Set a secure password
   - **Phone number**: Optional
5. Uncheck **Send an invitation to this new user?** if you want to share credentials manually
6. Click **Create user**

### User First Login

When a manually created user logs in for the first time:
1. They'll be prompted to change their temporary password
2. They can then access protected resources immediately
3. No email verification required for admin-created users

## Environment Variables

The deployment script automatically creates a `.env` file, but you can also set these manually:

```env
# AWS Configuration
PUBLIC_AWS_REGION=us-east-1

# Cognito Configuration
PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
PUBLIC_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Cognito Hosted UI
PUBLIC_COGNITO_HOSTED_UI_URL=https://my-app-dev-123456789.auth.us-east-1.amazoncognito.com
PUBLIC_COGNITO_HOSTED_UI_DOMAIN=my-app-dev-123456789

# API Gateway
PUBLIC_API_GATEWAY_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```

## Usage Examples

### Making Authenticated API Calls

```typescript
import { apiClient } from '$lib/auth/api-client'

// GET request with automatic JWT token
const data = await apiClient.get('/protected/users')

// POST request with body
const result = await apiClient.post('/protected/posts', {
  title: 'My Post',
  content: 'Post content'
})

// The JWT token is automatically included in the Authorization header
```

### Protecting Routes

```svelte
<script>
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte'
</script>

<AuthGuard>
  <!-- This content is only shown to authenticated users -->
  <h1>Protected Content</h1>
</AuthGuard>
```

### Accessing User Information

```svelte
<script>
  import { currentUser, isAuthenticated } from '$lib/auth/auth-store'
</script>

{#if $isAuthenticated}
  <p>Welcome, {$currentUser.email}!</p>
{:else}
  <a href="/auth/login">Sign In</a>
{/if}
```

### Custom Lambda Function with JWT

```javascript
exports.handler = async (event) => {
  // JWT claims are automatically available
  const claims = event.requestContext.authorizer.claims
  const userId = claims.sub
  const email = claims.email
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Hello authenticated user!',
      user: { id: userId, email }
    })
  }
}
```

## API Endpoints

After deployment, you'll have these endpoints available:

- `GET /protected/example` - Example protected endpoint
- Add your own endpoints by modifying the CloudFormation template

## Authentication Flow

1. **User Authorization**: Admin adds users via AWS Console OR users authenticate via Google OAuth
2. **Login**: User authenticates and receives JWT tokens
3. **API Calls**: JWT token automatically included in requests
4. **Token Refresh**: Tokens refreshed automatically before expiration
5. **Logout**: Tokens invalidated and removed

> **Note**: Self-registration is disabled. Access is restricted to authorized users only.

## Security Features

- **JWT Token Validation**: API Gateway validates tokens before reaching Lambda
- **Automatic Token Refresh**: Tokens refreshed 5 minutes before expiration
- **Secure Storage**: Tokens stored in localStorage with expiration checks
- **CORS Protection**: Proper CORS headers configured
- **Password Policy**: Enforced minimum password requirements

## Customization

### Adding New Protected Endpoints

1. Update `aws-infrastructure/api-gateway-with-auth.yaml`
2. Add new Lambda functions and API Gateway resources
3. Redeploy with the deployment script

### Modifying User Attributes

1. Update the Cognito User Pool schema in `cognito-user-pool.yaml`
2. Modify the signup form to collect additional attributes
3. Redeploy the infrastructure

### Custom Authentication UI

The authentication components are fully customizable:
- `src/lib/components/auth/LoginForm.svelte`
- `src/lib/components/auth/SignupForm.svelte`
- `src/lib/components/auth/UserMenu.svelte`

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your domain is added to the Cognito User Pool Client callback URLs
2. **Token Expired**: The system should auto-refresh, but check browser console for errors
3. **API Gateway 403**: Verify the JWT token is being sent in the Authorization header
4. **Email Verification**: Check spam folder for verification emails

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('auth_debug', 'true')
```

### CloudFormation Stack Issues

If deployment fails:
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name my-app-dev-cognito

# Delete and redeploy if needed
aws cloudformation delete-stack --stack-name my-app-dev-cognito
aws cloudformation delete-stack --stack-name my-app-dev-api
```

## Production Considerations

1. **Domain Configuration**: Update callback URLs for production domain
2. **Email Configuration**: Consider using SES for production email sending
3. **Monitoring**: Set up CloudWatch alarms for authentication failures
4. **Rate Limiting**: Consider adding rate limiting to prevent abuse
5. **Multi-Factor Authentication**: Enable MFA for enhanced security

## Cost Optimization

- Cognito User Pool: Free tier includes 50,000 MAUs
- API Gateway: $3.50 per million API calls
- Lambda: Free tier includes 1M requests/month
- CloudWatch Logs: $0.50 per GB ingested

## Next Steps

1. Customize the UI components to match your design
2. Add additional user attributes as needed
3. Implement role-based access control
4. Set up monitoring and alerting
5. Configure production domain and SSL

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review AWS Cognito documentation
3. Check CloudWatch logs for detailed error messages