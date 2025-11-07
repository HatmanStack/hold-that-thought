# Phase 1 Backend Testing Guide

This document provides testing instructions for all Phase 1 backend APIs.

## Prerequisites

- AWS CLI configured with credentials
- Cognito User Pool with test users in ApprovedUsers group
- DynamoDB tables deployed (via `dynamodb-tables.yaml`)
- Lambda functions deployed (via `lambda-functions.yaml`)
- API Gateway endpoints deployed (via `api-gateway-extensions.yaml`)

## Getting a JWT Token

```bash
# Authenticate test user
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <your-client-id> \
  --auth-parameters USERNAME=test@example.com,PASSWORD=YourPassword123!

# Extract AccessToken from response
export TOKEN="<access-token>"
export API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/prod"
```

## Unit Tests (Automated)

All Lambda functions have unit tests that can be run locally:

```bash
# Profile API
cd lambdas/profile-api && npm test

# Comments API
cd lambdas/comments-api && npm test

# Reactions API
cd lambdas/reactions-api && npm test

# Messages API
cd lambdas/messages-api && npm test
```

**Coverage Summary:**
- Profile API: 85% (13 tests)
- Comments API: 84% (19 tests)
- Reactions API: 89% (12 tests)
- Messages API: 67% (7 tests)

## Manual API Testing

### Profile API

```bash
# Get user profile
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/profile/test-user-123

# Update own profile
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"John Doe","bio":"Family historian"}' \
  $API_URL/profile

# Get user comment history
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/profile/test-user-123/comments?limit=10
```

### Comments API

```bash
# List comments on an item
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/comments/%2F2015%2Fchristmas?limit=50

# Create comment
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commentText":"Great letter!","itemType":"letter","itemTitle":"Christmas 2015"}' \
  $API_URL/comments/%2F2015%2Fchristmas

# Edit comment
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commentText":"Updated comment"}' \
  $API_URL/comments/%2F2015%2Fchristmas/2025-01-15T10:00:00.000Z%23abc

# Delete comment (soft delete)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  $API_URL/comments/%2F2015%2Fchristmas/2025-01-15T10:00:00.000Z%23abc
```

### Reactions API

```bash
# Toggle reaction (add/remove)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"/2015/christmas","reactionType":"like"}' \
  $API_URL/reactions/2025-01-15T10:00:00.000Z%23abc

# List all reactions
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/reactions/2025-01-15T10:00:00.000Z%23abc
```

### Messages API

```bash
# List conversations
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/messages/conversations

# Create 1-on-1 conversation
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participantIds":["user-1","user-2"],"messageText":"Hello!"}' \
  $API_URL/messages/conversations

# Send message
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageText":"How are you?"}' \
  $API_URL/messages/conversations/user-1%23user-2

# Mark as read
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  $API_URL/messages/conversations/user-1%23user-2/read

# Get presigned upload URL
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"photo.jpg","contentType":"image/jpeg"}' \
  $API_URL/messages/upload
```

## Stream Processor Testing

Stream processors (notification-processor, activity-aggregator) are triggered automatically by DynamoDB Streams. To test:

1. **Create test data** using the API endpoints above
2. **Check CloudWatch Logs** for Lambda execution logs
3. **Verify side effects:**
   - Notification processor: Check SES sent email logs (if configured)
   - Activity aggregator: Query UserProfiles table for updated commentCount/lastActive

```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/htt-notification-processor-prod --follow
aws logs tail /aws/lambda/htt-activity-aggregator-prod --follow

# Verify activity stats
aws dynamodb get-item \
  --table-name hold-that-thought-user-profiles-prod \
  --key '{"userId":{"S":"test-user-123"}}'
```

## Error Testing

Test error scenarios to validate error handling:

```bash
# 401 Unauthorized (no token)
curl $API_URL/profile/test-user-123

# 403 Forbidden (private profile)
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/profile/private-user-456

# 400 Bad Request (invalid input)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commentText":""}' \
  $API_URL/comments/%2F2015%2Fchristmas

# 404 Not Found (nonexistent resource)
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/profile/nonexistent-user
```

## Performance Testing

Use Apache Bench or similar tool to test API performance:

```bash
# Test comment creation performance
ab -n 100 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -p comment.json \
  $API_URL/comments/%2F2015%2Fchristmas
```

**Target Metrics:**
- API response time: < 500ms (p95)
- Comment submission: < 1s
- Page load (50 comments): < 2s

## Security Testing

Verify security controls:

1. **Authentication:** All endpoints require valid JWT
2. **Authorization:** Users can only modify their own resources
3. **XSS Prevention:** HTML sanitization in comments
4. **Private Profiles:** 403 for non-owners
5. **Message Privacy:** Only participants can access conversations
6. **Admin Controls:** Admin-only endpoints require Admins group

## Next Steps

After Phase 1 backend testing is complete:

1. **Proceed to Phase 2:** Implement frontend comment UI
2. **Deploy to staging:** Test with real users
3. **Performance tuning:** Optimize slow queries
4. **Security audit:** Review IAM permissions
