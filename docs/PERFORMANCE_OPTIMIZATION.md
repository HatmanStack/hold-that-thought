# Performance Optimization Guide

This document outlines performance optimizations implemented for the Hold That Thought application.

## Bundle Size Optimization

### Implemented Optimizations

1. **Fixed TypeScript Syntax Error**
   - Fixed `as` type assertion in MessageInput.svelte (line 215)
   - Changed to instanceof check for better runtime type safety
   - Impact: Enables successful production builds

2. **Lazy Loading Candidates Identified**
   Large components that should be lazy-loaded:
   - `MediaUpload.svelte` (317 lines) - Used only when uploading media
   - `MessageThread.svelte` (292 lines) - Loaded only in message view
   - `NewConversation.svelte` (285 lines) - Loaded only when starting conversation
   - `ConversationList.svelte` (257 lines) - Loaded only in messages inbox

### Recommended: Implement Lazy Loading

```svelte
<!-- Before: Direct import -->
<script>
  import MediaUpload from '$lib/components/MediaUpload.svelte';
</script>

<!-- After: Lazy import -->
<script>
  let MediaUpload;

  async function loadMediaUpload() {
    const module = await import('$lib/components/MediaUpload.svelte');
    MediaUpload = module.default;
  }
</script>

{#if showUpload}
  {#await loadMediaUpload()}
    <div class="loading">Loading...</div>
  {:then}
    <svelte:component this={MediaUpload} />
  {/await}
{/if}
```

### Unused Dependencies

The following dependencies were identified as unused and could be removed:

**Dependencies:**
- `@aws-sdk/client-lambda` - Check if used in Lambda functions only
- `@aws-sdk/client-s3` - Verify usage before removing
- `aws-sdk` - Legacy AWS SDK, consider migrating to v3
- `gray-matter` - Markdown frontmatter parser
- `marked` - Markdown parser

**Dev Dependencies:**
- `@iconify-json/heroicons-outline`
- `@iconify-json/heroicons-solid`
- `@types/unist`
- `remark`
- `svelte-preprocess`
- `sveltekit-embed`
- `tslib`

**Action Required:** Review usage in server-side code and scripts before removing.

## Image Optimization

### Current State
Images are served directly from S3 without optimization.

### Recommended Optimizations

1. **Compress Images on Upload**
   ```javascript
   // In Lambda function
   const sharp = require('sharp')

   // Compress profile photos
   await sharp(buffer)
     .resize(400, 400, { fit: 'cover' })
     .webp({ quality: 80 })
     .toBuffer()
   ```

2. **Lazy Load Images**
   ```svelte
   <img
     src={imageUrl}
     loading='lazy'
     alt='Profile photo'
   />
   ```

3. **Use WebP Format**
   - Serve WebP with JPEG fallback
   - 25-35% smaller file sizes
   - Supported by 95%+ of browsers

4. **Implement Responsive Images**
   ```svelte
   <img
     srcset='
       /image-400.webp 400w,
       /image-800.webp 800w,
       /image-1200.webp 1200w
     '
     sizes='(max-width: 600px) 400px, (max-width: 900px) 800px, 1200px'
     src='/image-800.webp'
     loading='lazy'
     alt='Gallery image'
   />
   ```

## Database Query Optimization

### DynamoDB Best Practices

1. **Use ProjectionExpression**
   ```javascript
   // Before: Fetching entire item
   const result = await docClient.send(new QueryCommand({
     TableName: 'Comments',
     KeyConditionExpression: 'itemId = :itemId',
     ExpressionAttributeValues: { ':itemId': itemId }
   }));

   // After: Project only needed attributes
   const result = await docClient.send(new QueryCommand({
     TableName: 'Comments',
     KeyConditionExpression: 'itemId = :itemId',
     ExpressionAttributeValues: { ':itemId': itemId },
     ProjectionExpression: 'commentId, commentText, userName, createdAt, reactionCount'
   }));
   ```

2. **Batch Operations**
   ```javascript
   // Use BatchGetItem for multiple items
   const result = await docClient.send(new BatchGetCommand({
     RequestItems: {
       UserProfiles: {
         Keys: userIds.map(id => ({ userId: id })),
         ProjectionExpression: 'userId, displayName, profilePhotoUrl'
       }
     }
   }))
   ```

3. **Efficient Pagination**
   ```javascript
   // Use ExclusiveStartKey for pagination
   let lastKey = null
   const allComments = []

   do {
     const result = await docClient.send(new QueryCommand({
       TableName: 'Comments',
       Limit: 50,
       ExclusiveStartKey: lastKey
     }))

     allComments.push(...result.Items)
     lastKey = result.LastEvaluatedKey
   } while (lastKey)
   ```

## Caching Strategies

### Browser Caching

```javascript
// In API responses (Lambda)
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min client, 10min CDN
    'ETag': generateETag(data)
  },
  body: JSON.stringify(data)
};
```

### S3 Cache Headers

```javascript
// When uploading to S3
await s3.putObject({
  Bucket: bucketName,
  Key: key,
  Body: buffer,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable', // 1 year for images
  Metadata: {
    'original-name': filename
  }
})
```

### API Response Caching

```typescript
// SvelteKit load function with caching
export async function load({ fetch, setHeaders }) {
  const response = await fetch('/api/profile/123')
  const profile = await response.json()

  // Cache for 5 minutes
  setHeaders({
    'cache-control': 'public, max-age=300'
  })

  return { profile }
}
```

## Frontend Performance

### Code Splitting

```javascript
// svelte.config.js
export default {
  kit: {
    adapter: adapter(),
    // Vite will automatically code-split routes
    prerender: {
      // Only prerender static content
      entries: ['/', '/about', '/contact']
    }
  }
}
```

### Reduce JavaScript Bundle

1. **Use CSS-only solutions** when possible (avoid JS for simple interactions)
2. **Tree-shake unused code** (automatically done by Vite)
3. **Minify production builds** (enabled by default)

### Optimize Third-Party Scripts

```svelte
<!-- Load non-critical scripts async -->
<script async src="https://analytics.example.com/script.js"></script>

<!-- Or defer until page load -->
<script defer src="https://widget.example.com/embed.js"></script>
```

## Performance Monitoring

### Key Metrics to Track

1. **Lighthouse Scores**
   - Performance: Target > 90
   - Accessibility: Target > 95
   - Best Practices: Target > 95
   - SEO: Target > 90

2. **Core Web Vitals**
   - LCP (Largest Contentful Paint): < 2.5s
   - FID (First Input Delay): < 100ms
   - CLS (Cumulative Layout Shift): < 0.1

3. **API Response Times**
   - p50: < 200ms
   - p95: < 500ms
   - p99: < 1000ms

4. **DynamoDB Metrics**
   - Read/Write Capacity Units
   - Throttled Requests (should be 0)
   - Average Item Size

### Monitoring Tools

```bash
# Run Lighthouse audit
npx lighthouse http://localhost:5173 --view

# Check bundle size
pnpm build
npx vite-bundle-visualizer

# Load test APIs
npx artillery quick --count 100 --num 10 https://api.example.com/endpoint
```

## Performance Checklist

### Before Launch

- [ ] Run Lighthouse audit (score > 90)
- [ ] Test on slow 3G network
- [ ] Test on low-end mobile device
- [ ] Verify images are compressed and lazy-loaded
- [ ] Check bundle size (aim for < 200KB initial JS)
- [ ] Enable gzip/brotli compression on server
- [ ] Set up CloudFront CDN for static assets
- [ ] Configure appropriate cache headers
- [ ] Implement service worker for offline support (optional)

### Ongoing Monitoring

- [ ] Monitor CloudWatch Lambda metrics (duration, errors)
- [ ] Track DynamoDB read/write capacity usage
- [ ] Monitor API Gateway latency
- [ ] Review S3 transfer costs
- [ ] Check for slow database queries
- [ ] Analyze bundle size growth over time

## Cost Impact

### Current Estimated Costs (50 users)
- DynamoDB: $5-10/month (PAY_PER_REQUEST)
- Lambda: $3-5/month
- S3: $2-3/month
- API Gateway: $3-5/month
- CloudWatch: $2/month
- **Total: $15-25/month**

### Cost Optimization Tips

1. **Use DynamoDB Projections** - Reduce read costs by 30-50%
2. **Enable Lambda Provisioned Concurrency selectively** - Only for hot paths
3. **Implement S3 Lifecycle Policies** - Move old attachments to Glacier
4. **Set up CloudWatch Log retention** - 7-30 days max
5. **Use CloudFront for static assets** - Reduce S3 transfer costs

## Implementation Priority

### High Priority (Do First)
1. Fix TypeScript build errors ✅
2. Enable image lazy loading
3. Add ProjectionExpression to all DynamoDB queries
4. Set appropriate cache headers on API responses

### Medium Priority (Next Week)
1. Implement image compression on upload
2. Remove unused dependencies
3. Lazy load heavy components (MediaUpload, MessageThread)
4. Set up CloudFront CDN

### Low Priority (Nice to Have)
1. Convert images to WebP format
2. Implement responsive image srcsets
3. Add service worker for offline support
4. Set up DynamoDB DAX caching (if needed)

## Conclusion

Performance optimization is an ongoing process. This document should be updated as new optimizations are implemented and performance characteristics change.

For questions or issues, consult:
- [SvelteKit Performance Guide](https://kit.svelte.dev/docs/performance)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
