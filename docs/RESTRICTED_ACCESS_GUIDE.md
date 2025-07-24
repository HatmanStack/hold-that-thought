# Restricted Access Authentication Guide

This system provides **controlled access** to your application with **no self-registration**. Only authorized users can access the application through two methods:

## 🔐 Access Control Methods

### 1. Google OAuth (Recommended)
- Users sign in with their Google accounts
- You control access by configuring allowed domains or specific emails
- Automatic user provisioning for approved Google accounts
- No manual user management required

### 2. Manual User Management
- Admin creates users directly in AWS Cognito Console
- Full control over who gets access
- Users receive temporary passwords that must be changed on first login
- Perfect for internal teams or specific user lists

## 🚀 Quick Setup

### Deploy Infrastructure
```bash
# Without Google OAuth (manual users only)
./scripts/deploy-auth-infrastructure.sh dev my-app

# With Google OAuth enabled
./scripts/deploy-auth-infrastructure.sh dev my-app YOUR_GOOGLE_CLIENT_ID YOUR_GOOGLE_CLIENT_SECRET
```

### Add Your First User
1. Go to **AWS Console** → **Cognito** → **User Pools**
2. Select your user pool (e.g., `my-app-dev-user-pool`)
3. Click **Users** → **Create user**
4. Enter email and temporary password
5. User can now sign in at `/auth/login`

## 🛡️ Security Benefits

- **No spam registrations** - Only authorized users can access
- **Admin control** - You decide who gets access
- **Google OAuth integration** - Leverage Google's security
- **JWT token validation** - Secure API access
- **Automatic token refresh** - Seamless user experience

## 👥 User Management Workflows

### For Google OAuth Users
```
1. User clicks "Continue with Google"
2. Google authentication
3. If email is approved → Access granted
4. If email not approved → Access denied
```

### For Manual Users
```
1. Admin creates user in AWS Console
2. User receives login credentials
3. User signs in with email/password
4. Forced password change on first login
5. Access granted
```

## 🔧 Advanced Configuration

### Restrict Google OAuth to Specific Domains
You can configure Cognito to only allow users from specific domains:

1. Go to **AWS Console** → **Cognito** → **User Pools** → **Your Pool**
2. Click **Sign-in experience** → **Federated identity provider sign-in**
3. Edit the Google identity provider
4. Add attribute mapping rules to restrict domains

### Email Domain Filtering (Lambda Trigger)
For more advanced control, you can add a Lambda trigger to filter users:

```javascript
exports.handler = async (event) => {
    const email = event.request.userAttributes.email;
    const allowedDomains = ['yourcompany.com', 'partner.com'];
    
    const domain = email.split('@')[1];
    if (!allowedDomains.includes(domain)) {
        throw new Error('Email domain not authorized');
    }
    
    return event;
};
```

## 📊 Access Patterns

### Typical Use Cases
- **Internal company applications**
- **Client portals with controlled access**
- **Beta testing with invited users**
- **Partner/vendor access systems**
- **Admin dashboards**

### User Experience
- Clean, professional login page
- Multiple authentication options
- Clear messaging about restricted access
- Smooth OAuth flow with Google
- Automatic redirects after authentication

## 🔍 Monitoring & Management

### Track User Access
- CloudWatch logs show authentication attempts
- Cognito console shows user activity
- Failed login attempts are logged
- Token usage can be monitored

### User Lifecycle Management
1. **Add User**: AWS Console or API
2. **Monitor Usage**: CloudWatch metrics
3. **Disable User**: AWS Console
4. **Remove User**: Delete from user pool

## 🚨 Important Notes

- **Self-registration is completely disabled**
- **Users cannot create their own accounts**
- **All access must be explicitly granted by admin**
- **Google OAuth users still need domain approval**
- **Manual users must be created by admin**

## 🔄 Migration from Open Registration

If you're migrating from an open registration system:

1. **Export existing users** from your current system
2. **Import users** into Cognito via AWS CLI or Console
3. **Set temporary passwords** for imported users
4. **Notify users** of the new login process
5. **Test the authentication flow** thoroughly

## 📞 Support & Troubleshooting

### Common Issues
- **"Access Denied"**: User not in approved list
- **Google OAuth fails**: Check redirect URIs
- **Password issues**: Reset via AWS Console
- **Token expired**: Automatic refresh should handle this

### Getting Help
1. Check CloudWatch logs for detailed errors
2. Verify user exists in Cognito User Pool
3. Confirm Google OAuth configuration
4. Test with a known working user account

---

This restricted access system gives you complete control over who can use your application while providing a smooth user experience for authorized users.