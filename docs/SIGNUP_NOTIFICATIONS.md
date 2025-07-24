# Signup Notification Setup

This guide explains how to set up email notifications for new user signups in your Cognito User Pool.

## Overview

When a user signs up for your application through Google OAuth, you'll automatically receive an email notification with:
- User's name and email
- Signup timestamp
- Instructions for approving the user
- AWS CLI command to add them to the ApprovedUsers group

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **SES (Simple Email Service)** access in your AWS region
3. **Email address verified** in SES for sending notifications

## Deployment Steps

### 1. Deploy the Signup Notification System

Run the deployment script:

```bash
./scripts/deploy-signup-notifications.sh
```

This script will:
- Verify your notification email address in SES
- Deploy a Lambda function to handle signup notifications
- Update your Cognito User Pool with the Lambda trigger

### 2. Verify Your Email Address

After running the deployment script:
1. Check your email inbox for an SES verification email
2. Click the verification link to confirm your email address
3. You must do this before notifications will work

### 3. Test the Setup

Have someone sign up for your application through the normal Google OAuth flow. You should receive an email notification within a few minutes.

## Email Notification Content

The notification email includes:

- **User Information**: Name, email, signup time
- **Approval Instructions**: Step-by-step guide to approve the user
- **AWS CLI Command**: Ready-to-use command to add the user to ApprovedUsers group

Example email content:
```
New User Signup - Hold That Thought (PROD)

A new user has signed up:
Name: John Doe
Email: john.doe@example.com
Time: 2024-01-15 14:30:22 UTC

To approve this user, add them to the ApprovedUsers group:
aws cognito-idp admin-add-user-to-group --user-pool-id us-west-2_X8J2UR7BF --username john.doe@example.com --group-name ApprovedUsers
```

## Approving Users

### Option 1: AWS CLI (Recommended)

Use the command provided in the notification email:

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --username user@example.com \
  --group-name ApprovedUsers
```

### Option 2: Using the Helper Script

Use the provided Node.js script:

```bash
node scripts/add-approved-user.js user@example.com
```

You can also approve multiple users at once:

```bash
node scripts/add-approved-user.js user1@example.com user2@example.com user3@example.com
```

### Option 3: AWS Console

1. Go to AWS Cognito Console
2. Navigate to User Pools → your-user-pool
3. Go to Users and groups → Groups
4. Select "ApprovedUsers" group
5. Click "Add users to group"
6. Select the user and add them

## Configuration

### Changing the Notification Email

To change the email address that receives notifications:

1. Edit `scripts/deploy-signup-notifications.sh`
2. Update the `NOTIFICATION_EMAIL` variable
3. Re-run the deployment script
4. Verify the new email address in SES

### Customizing the Email Content

To customize the notification email:

1. Edit `aws-infrastructure/signup-notification-lambda.yaml`
2. Modify the email content in the Lambda function code
3. Redeploy using the deployment script

## Troubleshooting

### No Email Notifications Received

1. **Check SES verification**: Ensure your email is verified in SES
2. **Check spam folder**: Notifications might be filtered as spam
3. **Check Lambda logs**: Go to CloudWatch → Log Groups → `/aws/lambda/hold-that-thought-prod-signup-notification`
4. **Check Lambda permissions**: Ensure the Lambda has SES permissions

### Lambda Function Errors

Check CloudWatch logs for the Lambda function:

```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/hold-that-thought-prod-signup-notification"
```

### SES Issues

If you're in the SES sandbox (new AWS accounts):
1. You can only send emails to verified addresses
2. Request production access through the SES console
3. Or verify additional email addresses for testing

## Architecture

```
User Signup (Google OAuth)
    ↓
Cognito User Pool
    ↓
Pre-Signup Lambda Trigger
    ↓
Lambda Function
    ↓
SES Email Notification
    ↓
Admin receives email with approval instructions
```

## Security Notes

- The Lambda function only sends notifications; it doesn't modify user data
- Email content includes user information but no sensitive data
- The Lambda has minimal permissions (only SES send email)
- Signup process continues normally even if email notification fails

## Cost Considerations

- **Lambda**: Free tier covers typical usage (1M requests/month)
- **SES**: $0.10 per 1,000 emails sent
- **CloudWatch Logs**: Minimal cost for log storage

For a family application with occasional signups, costs should be negligible.

## Monitoring

Monitor the system through:
- **CloudWatch Metrics**: Lambda invocations, errors, duration
- **CloudWatch Logs**: Detailed execution logs
- **SES Metrics**: Email delivery statistics

## Next Steps

After setting up notifications:
1. Test the complete flow with a new user signup
2. Document your approval process for family administrators
3. Consider setting up additional notifications (approval confirmations, etc.)
4. Monitor the system for the first few weeks to ensure reliability