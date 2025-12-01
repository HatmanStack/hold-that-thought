# Monitoring and Alerting Guide

This guide explains how to monitor the Hold That Thought application in production.

## Overview

The monitoring stack includes:
- **CloudWatch Dashboard** - Visual metrics for all services
- **CloudWatch Alarms** - Automated alerts for critical issues
- **SNS Notifications** - Email alerts to administrators
- **X-Ray Tracing** (optional) - Distributed request tracing

## Quick Start

### Deploy Monitoring Stack

```bash
# Deploy CloudFormation monitoring stack
aws cloudformation deploy \
  --template-file cloudformation/monitoring.yaml \
  --stack-name hold-that-thought-monitoring-prod \
  --parameter-overrides \
    Environment=production \
    AlertEmail=admin@holdthatthought.family \
    CommentsApiLambdaName=comments-api-lambda \
    MessagesApiLambdaName=messages-api-lambda \
    ProfileApiLambdaName=profile-api-lambda \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### Confirm SNS Subscription

After deployment:
1. Check your email for SNS subscription confirmation
2. Click the confirmation link
3. You'll now receive alerts via email

## CloudWatch Dashboard

### Accessing the Dashboard

1. Go to AWS Console → CloudWatch → Dashboards
2. Select `production-hold-that-thought`
3. Bookmark this URL for quick access

### Dashboard Widgets

**Lambda Invocations**
- Total requests per Lambda function
- Use to track usage patterns
- Expected: Increases during active hours

**Lambda Errors & Throttles**
- Error count per function
- Throttling events (should be 0)
- Alert if errors > 5 in 5 minutes

**Lambda Duration**
- Average, p95, and p99 response times
- Target: p95 < 500ms
- Alert if > 3 seconds

**DynamoDB Errors**
- User errors (bad requests)
- System errors (AWS issues)
- Conditional check failures
- Target: Near zero

**DynamoDB Capacity**
- Read and write capacity consumed
- Use for cost estimation
- PAY_PER_REQUEST mode: No throttling

**API Gateway Errors**
- 4XX errors (client mistakes)
- 5XX errors (server failures)
- Alert if 5XX > 10 in 5 minutes

**API Gateway Latency**
- Average, p95, p99 latencies
- Target: p95 < 500ms
- Includes Lambda execution time

**SES Email Delivery**
- Sent, bounced, complained, rejected
- Target: Bounce rate < 5%
- Alert if bounce rate too high

## CloudWatch Alarms

### Active Alarms

| Alarm | Threshold | Action |
|-------|-----------|--------|
| Comments API High Error Rate | > 5 errors in 5 min | Email alert |
| Messages API High Error Rate | > 5 errors in 5 min | Email alert |
| Profile API High Error Rate | > 5 errors in 5 min | Email alert |
| Lambda High Duration | > 3 seconds | Email alert |
| DynamoDB Throttling | > 0 throttles | Email alert |
| API Gateway 5XX Errors | > 10 in 5 min | Email alert |
| API Gateway High Latency | p95 > 3 seconds | Email alert |
| SES High Bounce Rate | > 5% | Email alert |

### Responding to Alarms

#### High Error Rate

1. Check CloudWatch Logs for Lambda function
2. Look for stack traces or error messages
3. Common causes:
   - Invalid user input (add validation)
   - Database connection issues
   - Timeout errors (increase Lambda timeout)
4. Fix and redeploy
5. Monitor to confirm fix

#### High Latency

1. Check Lambda duration metrics
2. Identify slow operations:
   - DynamoDB queries without ProjectionExpression
   - Large result sets
   - External API calls
3. Optimize queries or add caching
4. Consider increasing Lambda memory (improves CPU)

#### DynamoDB Throttling

1. Check consumed capacity metrics
2. If PAY_PER_REQUEST mode: Should not throttle
3. If provisioned mode: Increase capacity
4. Review queries for efficiency

#### High Bounce Rate

1. Check SES reputation dashboard
2. Review bounced email addresses
3. Remove invalid addresses from database
4. Verify SES domain configuration

## Logging Best Practices

### What to Log

**✅ Good:**
```javascript
console.log('Comment created', {
  userId,
  itemId,
  commentId,
  timestamp: new Date().toISOString()
})
```

**❌ Bad:**
```javascript
// Don't log sensitive data
console.log('Request:', JSON.stringify(event)) // May contain tokens
console.log('Password:', password) // Never log credentials
```

### CloudWatch Logs Insights

Query logs with CloudWatch Logs Insights:

```
# Find all errors in last hour
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

```
# Find slow Lambda invocations
fields @timestamp, @message, @duration
| filter @duration > 1000
| sort @duration desc
| limit 50
```

```
# Count errors by type
fields @message
| filter @message like /ERROR/
| stats count() by @message
| sort count desc
```

## X-Ray Tracing (Optional)

### Enable X-Ray

Add to Lambda function configuration:
```yaml
# CloudFormation
Properties:
  TracingConfig:
    Mode: Active
```

### View Traces

1. Go to AWS Console → X-Ray → Service Map
2. See visual map of request flow
3. Click on service to see traces
4. Identify bottlenecks and errors

### Sample Code

```javascript
const AWSXRay = require('aws-xray-sdk-core')
const AWS = AWSXRay.captureAWS(require('aws-sdk'))

// X-Ray will automatically trace DynamoDB calls
const docClient = new AWS.DynamoDB.DocumentClient()
```

## Metrics to Track

### System Health

| Metric | Target | Alert |
|--------|--------|-------|
| Lambda Error Rate | < 0.1% | > 1% |
| Lambda Duration (p95) | < 500ms | > 3s |
| API Latency (p95) | < 500ms | > 3s |
| DynamoDB Throttles | 0 | > 0 |
| SES Bounce Rate | < 2% | > 5% |

### Business Metrics

Track in custom CloudWatch metrics or database:

| Metric | Description |
|--------|-------------|
| Comments per day | User engagement |
| Messages sent per day | Communication activity |
| Active users (7 day) | Retention rate |
| Profile views per day | Community interaction |
| Media uploads per day | Content contribution |

### Custom Metrics

```javascript
// Lambda function
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch')

async function trackCommentCreated(itemId) {
  const client = new CloudWatchClient({ region: 'us-east-1' })

  await client.send(new PutMetricDataCommand({
    Namespace: 'HoldThatThought',
    MetricData: [{
      MetricName: 'CommentsCreated',
      Value: 1,
      Unit: 'Count',
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'ItemId', Value: itemId }
      ]
    }]
  }))
}
```

## Cost Monitoring

### CloudWatch Costs

- Metrics: $0.30 per metric per month (first 10,000 metrics free)
- Dashboards: $3 per dashboard per month
- Alarms: $0.10 per alarm per month (first 10 alarms free)
- Logs: $0.50 per GB ingested, $0.03 per GB stored
- Logs Insights: $0.005 per GB scanned

**Estimated Cost:** $10-20/month for full monitoring

### Cost Optimization

1. **Set Log Retention:** 7-30 days max
   ```bash
   aws logs put-retention-policy \
     --log-group-name /aws/lambda/comments-api \
     --retention-in-days 7
   ```

2. **Filter Logs:** Only log warnings/errors in production
   ```javascript
   if (process.env.LOG_LEVEL !== 'DEBUG') {
     // Skip verbose logging
   }
   ```

3. **Sample Metrics:** Use percentile metrics (p95, p99) instead of detailed statistics

## Incident Response

### Alert Received - What to Do?

1. **Acknowledge Alert**
   - Reply to email or mark SNS message as read
   - Log incident in tracking system

2. **Assess Severity**
   - Critical: System down, data loss risk
   - High: Errors affecting users
   - Medium: Performance degradation
   - Low: Warning threshold reached

3. **Investigate**
   - Check CloudWatch Dashboard
   - Review CloudWatch Logs
   - Look for patterns (time, user, feature)

4. **Mitigate**
   - Roll back recent deployment if related
   - Scale resources if capacity issue
   - Disable feature if causing problems

5. **Fix**
   - Implement permanent fix
   - Deploy and monitor
   - Document root cause

6. **Follow Up**
   - Update runbooks
   - Improve monitoring/alerts
   - Post-mortem if needed

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Primary On-Call | [Phone/Email] | Immediate |
| Secondary On-Call | [Phone/Email] | After 15 min |
| Engineering Lead | [Phone/Email] | If unresolved |
| Product Owner | [Email] | Business impact |

## Monitoring Checklist

### Daily

- [ ] Check CloudWatch Dashboard for anomalies
- [ ] Review any alarms that triggered
- [ ] Check error logs in CloudWatch Logs

### Weekly

- [ ] Review p95/p99 latency trends
- [ ] Check DynamoDB capacity usage
- [ ] Review SES bounce/complaint rates
- [ ] Check Lambda cold start metrics
- [ ] Review custom business metrics

### Monthly

- [ ] Review CloudWatch costs
- [ ] Update alert thresholds if needed
- [ ] Archive old logs
- [ ] Update runbooks with new learnings
- [ ] Test incident response procedures

## Advanced Monitoring

### Synthetic Monitoring

Use CloudWatch Synthetics to test API endpoints:

```python
# canary-script.py
from aws_synthetics.selenium import synthetics_webdriver as webdriver
from aws_synthetics.common import synthetics_logger as logger

def main():
    browser = webdriver.Chrome()
    browser.get("https://holdthatthought.family")

    # Test login flow
    browser.find_element_by_id("email").send_keys("test@example.com")
    browser.find_element_by_id("password").send_keys("TestPass123!")
    browser.find_element_by_id("login-button").click()

    # Verify success
    assert "Dashboard" in browser.title

    browser.quit()

async def handler(event, context):
    return main()
```

### Real User Monitoring (RUM)

Add CloudWatch RUM to frontend:

```html
<!-- Add to <head> -->
<script>
  (function(n,i,v,r,s,c,x,z){/* CloudWatch RUM snippet */})();
  cwr('init', {
    sessionSampleRate: 1,
    guestRoleArn: 'arn:aws:iam::ACCOUNT:role/RUM-Monitor',
    identityPoolId: 'us-east-1:xxx',
    endpoint: 'https://rum.us-east-1.amazonaws.com',
    telemetries: ['errors', 'performance', 'http']
  });
</script>
```

## Troubleshooting

### Dashboard Not Showing Data

1. Check Lambda function names match parameters
2. Verify IAM role has CloudWatch permissions
3. Wait 5-10 minutes for initial data

### Alarms Not Triggering

1. Confirm SNS subscription confirmed
2. Check alarm state (OK, ALARM, INSUFFICIENT_DATA)
3. Verify metrics are being published

### Too Many False Positives

1. Adjust alarm thresholds
2. Increase evaluation periods
3. Use anomaly detection instead of static thresholds

## Resources

- [CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [X-Ray Developer Guide](https://docs.aws.amazon.com/xray/latest/devguide/)
- [AWS Well-Architected Framework - Reliability](https://wa.aws.amazon.com/wat.pillar.reliability.en.html)

## Conclusion

Effective monitoring is critical for maintaining application health and user satisfaction. Follow this guide to:
- Proactively detect issues before users report them
- Respond quickly to incidents
- Continuously improve system reliability

**Next Steps:**
1. Deploy monitoring stack
2. Set up email alerts
3. Bookmark CloudWatch Dashboard
4. Test incident response procedures
5. Train team on monitoring tools
