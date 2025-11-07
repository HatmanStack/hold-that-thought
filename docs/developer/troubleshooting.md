# Troubleshooting Guide

Common issues and solutions for Hold That Thought development and deployment.

## Development Issues

### TypeScript Errors

**Error:** `svelte-check found 209 errors`

**Solution:**
```bash
# Fix import statements
# Change: import { Page } from '@playwright/test';
# To: import type { Page } from '@playwright/test';

# Run type check
pnpm check

# Should show 0 errors
```

**Error:** `Property 'X' does not exist on type 'Y'`

**Common Causes:**
- Missing type definitions
- Incorrect import path
- Type mismatch

**Solution:**
```bash
# Install missing types
pnpm add -D @types/package-name

# Or add type assertion
const value = someValue as ExpectedType;
```

###  Build Failures

**Error:** `pnpm build` fails with memory error

**Solution:**
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max_old_space_size=7680"
pnpm build
```

**Error:** `Cannot find module 'urara'`

**Solution:**
```bash
# Create missing urara directory
mkdir -p urara

# Or skip urara build
pnpm kit:build
```

### E2E Test Issues

**Error:** `page.click(...).first() is not a function`

**Solution:**
```typescript
// Wrong:
await page.click('button').first();

// Correct:
await page.locator('button').first().click();
```

**Error:** Playwright browsers not installed

**Solution:**
```bash
npx playwright install chromium firefox
```

### Authentication Issues

**Error:** "No authentication tokens available"

**Cause:** User not logged in or tokens expired

**Solution:**
1. Check localStorage for auth tokens
2. Log in again if tokens expired
3. Verify Cognito configuration

```javascript
// Check tokens in browser console
localStorage.getItem('auth_tokens')
localStorage.getItem('auth_user')
```

### API Request Failures

**Error:** CORS error in browser

**Cause:** API Gateway CORS not configured properly

**Solution:**
```yaml
# In API Gateway CloudFormation
Cors:
  AllowOrigin: "'https://your-domain.com'"
  AllowHeaders: "'Content-Type,Authorization'"
  AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
```

**Error:** 401 Unauthorized

**Causes:**
1. Missing Authorization header
2. Invalid JWT token
3. Token expired

**Solution:**
```javascript
// Verify token is being sent
console.log('Token:', localStorage.getItem('auth_tokens'));

// Check token expiry
const tokens = JSON.parse(localStorage.getItem('auth_tokens'));
console.log('Expires at:', new Date(tokens.expiresAt));
console.log('Now:', new Date());

// Refresh token if expired
// (implement token refresh logic)
```

## Deployment Issues

### CloudFormation Stack Failures

**Error:** `Stack is in ROLLBACK_COMPLETE state`

**Solution:**
```bash
# Delete failed stack
aws cloudformation delete-stack --stack-name your-stack-name

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name your-stack-name

# Deploy again
aws cloudformation deploy --template-file template.yaml --stack-name your-stack-name
```

**Error:** `Resource already exists`

**Cause:** Trying to create resource that already exists

**Solution:**
- Import existing resource into stack
- Or delete resource manually first
- Or use different resource name

### Lambda Deployment Issues

**Error:** `Code size exceeds maximum`

**Cause:** Lambda package > 250MB (unzipped)

**Solution:**
```bash
# Remove dev dependencies
cd lambdas/function-name
rm -rf node_modules
npm install --production

# Exclude unnecessary files
zip -r function.zip . -x "*.git*" "test/*" "*.md"
```

**Error:** Lambda function times out

**Causes:**
1. DynamoDB query taking too long
2. External API call slow
3. Cold start

**Solution:**
```yaml
# Increase timeout (max 15 minutes)
Properties:
  Timeout: 30  # 30 seconds

# Or optimize code:
# - Add DynamoDB ProjectionExpression
# - Use batch operations
# - Enable provisioned concurrency for hot functions
```

### DynamoDB Issues

**Error:** `ProvisionedThroughputExceededException`

**Cause:** Too many requests for provisioned capacity

**Solution:**
```yaml
# Switch to PAY_PER_REQUEST
BillingMode: PAY_PER_REQUEST

# Or increase provisioned capacity
ProvisionedThroughput:
  ReadCapacityUnits: 10  # Increase this
  WriteCapacityUnits: 5   # And this
```

**Error:** `ValidationException: Item size exceeds limit`

**Cause:** DynamoDB item > 400KB

**Solution:**
- Store large content in S3
- Reference S3 key in DynamoDB
- Compress data before storing

### S3 Issues

**Error:** `Access Denied` when uploading

**Cause:** Insufficient IAM permissions

**Solution:**
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:PutObjectAcl"
  ],
  "Resource": "arn:aws:s3:::bucket-name/*"
}
```

**Error:** Presigned URL expired

**Cause:** URL expiry time passed

**Solution:**
```javascript
// Generate new presigned URL
const command = new GetObjectCommand({
  Bucket: bucketName,
  Key: key
});
const url = await getSignedUrl(s3Client, command, {
  expiresIn: 3600  // 1 hour
});
```

### SES Email Issues

**Error:** `Email address not verified`

**Cause:** SES in sandbox mode

**Solution:**
1. **For testing:** Verify recipient email addresses individually
2. **For production:** Request production access
   ```bash
   # AWS Console → SES → Account dashboard → Request production access
   ```

**Error:** High bounce rate

**Causes:**
- Invalid email addresses in database
- Emails marked as spam

**Solution:**
1. Remove invalid addresses
2. Implement double opt-in
3. Monitor SES reputation dashboard

## Runtime Issues

### High Error Rates

**Symptom:** CloudWatch alarm triggered for Lambda errors

**Investigation:**
```bash
# View Lambda logs
aws logs tail /aws/lambda/function-name --follow

# Or use CloudWatch Logs Insights:
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

**Common Causes:**
1. Invalid user input
2. DynamoDB item not found
3. External service unavailable
4. Timeout

**Solutions:**
- Add input validation
- Add null checks
- Implement retry logic
- Increase timeout

### High Latency

**Symptom:** API Gateway latency > 3 seconds

**Investigation:**
```bash
# Enable X-Ray tracing
aws lambda update-function-configuration \
  --function-name function-name \
  --tracing-config Mode=Active

# View X-Ray traces in AWS Console
```

**Common Causes:**
1. DynamoDB scan operation (slow)
2. Large response payload
3. Lambda cold start
4. Inefficient code

**Solutions:**
- Use Query instead of Scan
- Add ProjectionExpression to limit data
- Enable provisioned concurrency
- Optimize algorithm

### Memory Issues

**Symptom:** Lambda out of memory errors

**Investigation:**
```bash
# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name MemoryUtilization \
  --dimensions Name=FunctionName,Value=function-name \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-15T00:00:00Z \
  --period 3600 \
  --statistics Average
```

**Solution:**
```yaml
# Increase Lambda memory
Properties:
  MemorySize: 512  # Increase from 128MB default
```

## Monitoring & Alerting Issues

### Alarms Not Triggering

**Cause:** Insufficient data or incorrect threshold

**Solution:**
```yaml
# Check alarm configuration
TreatMissingData: notBreaching  # Don't alarm on missing data

# Or adjust threshold
Threshold: 10  # Increase if too sensitive
```

### False Positives

**Cause:** Threshold too low or temporary spike

**Solution:**
```yaml
# Require multiple periods
EvaluationPeriods: 2  # Alarm after 2 consecutive breaches

# Or use anomaly detection
MetricMath:
  Expression: "ANOMALY_DETECTION_BAND(m1, 2)"
```

### Dashboard Not Showing Data

**Cause:** Wrong region or resource name

**Solution:**
- Verify region in dashboard configuration
- Check Lambda function names match
- Wait 5-10 minutes for initial data

## Performance Issues

### Slow Page Load

**Investigation:**
```bash
# Run Lighthouse audit
npx lighthouse https://your-site.com --view
```

**Common Causes:**
1. Large bundle size
2. Unoptimized images
3. Blocking JavaScript
4. Slow API calls

**Solutions:**
- Code split routes
- Lazy load components
- Compress images
- Add caching headers

### Slow API Responses

**Investigation:**
```bash
# Load test API
export TEST_TOKEN="your-jwt-token"
npx artillery run tests/load/comments-load.yml
```

**Solutions:**
- Add DynamoDB indexes
- Use batch operations
- Implement caching (CloudFront, browser)
- Optimize database queries

## Testing Issues

### Load Tests Failing

**Error:** `artillery: command not found`

**Solution:**
```bash
pnpm add -D artillery
```

**Error:** `401 Unauthorized` during load test

**Cause:** Missing or expired test token

**Solution:**
```bash
# Get fresh token
export TEST_TOKEN=$(cat ~/.auth-token)

# Or generate test token via Cognito
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id your-client-id \
  --auth-parameters USERNAME=test@example.com,PASSWORD=TestPass123!
```

### E2E Tests Flaky

**Causes:**
- Network timing issues
- Race conditions
- Async operations not awaited

**Solutions:**
```typescript
// Increase timeouts
await expect(element).toBeVisible({ timeout: 10000 });

// Wait for network idle
await page.waitForLoadState('networkidle');

// Add explicit waits
await page.waitForSelector('[data-testid="comment-section"]');
```

## Security Issues

### Dependency Vulnerabilities

**Check:**
```bash
pnpm audit
```

**Fix:**
```bash
# Update vulnerable packages
pnpm update package-name

# Or update all
pnpm update
```

### CORS Errors

**Symptom:** Browser blocks API requests

**Solution:**
```yaml
# API Gateway CORS configuration
Cors:
  AllowOrigin: "'https://your-domain.com'"
  AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
  AllowHeaders: "'Content-Type,Authorization'"
  AllowCredentials: true
```

### CSP Violations

**Symptom:** Browser console shows CSP errors

**Solution:**
```typescript
// Update CSP headers in hooks.server.ts
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline'"
);
```

## Getting Help

### Before Asking for Help

1. Check CloudWatch Logs
2. Review error messages carefully
3. Search this troubleshooting guide
4. Check AWS Service Health Dashboard
5. Review recent code changes

### Information to Provide

When reporting an issue, include:
- Error message (full text)
- CloudWatch log excerpt
- Steps to reproduce
- Environment (dev/staging/prod)
- Recent changes
- CloudFormation stack status

### Support Channels

- **GitHub Issues:** https://github.com/your-org/hold-that-thought/issues
- **Email:** support@holdthatthought.family
- **AWS Support:** (if infrastructure issue)

## Useful Commands

### Check Status

```bash
# All CloudFormation stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Lambda function status
aws lambda get-function --function-name function-name

# DynamoDB table status
aws dynamodb describe-table --table-name table-name

# S3 bucket contents
aws s3 ls s3://bucket-name --recursive
```

### Debug Logs

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/function-name --follow

# Query logs with Insights
aws logs start-query \
  --log-group-name /aws/lambda/function-name \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20'
```

### Performance

```bash
# Lighthouse audit
npx lighthouse https://your-site.com --output html --output-path ./report.html

# Load test
npx artillery quick --count 100 --num 10 https://api.your-site.com/endpoint
```

## Preventive Measures

### Before Deploying

- [ ] Run all tests (`pnpm test:e2e`, `pnpm test:load`)
- [ ] Run `pnpm check` (0 TypeScript errors)
- [ ] Run `pnpm audit` (0 high/critical vulnerabilities)
- [ ] Test in staging environment
- [ ] Have rollback plan ready

### After Deploying

- [ ] Run smoke tests
- [ ] Monitor CloudWatch Dashboard for 1 hour
- [ ] Check CloudWatch Alarms (all should be OK)
- [ ] Test critical user flows
- [ ] Monitor error rates

### Regular Maintenance

- [ ] Weekly: Review CloudWatch alarms
- [ ] Monthly: Update dependencies
- [ ] Quarterly: Security audit
- [ ] Annually: Review IAM permissions

## Additional Resources

- [AWS Troubleshooting Guide](https://docs.aws.amazon.com/troubleshooting/)
- [Lambda Troubleshooting](https://docs.aws.amazon.com/lambda/latest/dg/lambda-troubleshooting.html)
- [DynamoDB Troubleshooting](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.Troubleshooting.html)
- [SvelteKit FAQ](https://kit.svelte.dev/faq)
