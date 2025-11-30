import { handler } from '../index.js';
import fs from 'fs';
import path from 'path';

// Mock event for a valid image upload
const validImageEvent = {
  httpMethod: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
    Authorization: 'Bearer mock-jwt-token'
  },
  requestContext: {
    authorizer: {
      claims: {
        sub: 'user-123',
        email: 'user@example.com',
        'cognito:groups': ['ApprovedUsers']
      }
    }
  },
  body: fs.readFileSync(path.join(__dirname, 'mock-image-upload-body.txt'), 'utf8'),
  isBase64Encoded: false
};

// Additional test: invalid JWT (missing claims)
const invalidJwtEvent = {
  httpMethod: 'POST',
  headers: validImageEvent.headers,
  requestContext: {},
  body: validImageEvent.body,
  isBase64Encoded: false
};

// Additional test: file too large
const largeFileEvent = {
  ...validImageEvent,
  body: 'x'.repeat(11 * 1024 * 1024) // 11MB dummy body
};

// Additional test: disallowed file type
const disallowedTypeEvent = {
  ...validImageEvent,
  headers: {
    ...validImageEvent.headers,
    'Content-Type': 'application/x-msdownload'
  }
};

(async () => {
  const validResult = await handler(validImageEvent);
  console.log('Valid image upload result:', validResult);

  const invalidJwtResult = await handler(invalidJwtEvent);
  console.log('Invalid JWT result:', invalidJwtResult);

  const largeFileResult = await handler(largeFileEvent);
  console.log('Large file result:', largeFileResult);

  const disallowedTypeResult = await handler(disallowedTypeEvent);
  console.log('Disallowed type result:', disallowedTypeResult);
})();
