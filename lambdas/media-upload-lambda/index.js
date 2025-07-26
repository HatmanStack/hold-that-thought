import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });
const BUCKET_NAME = process.env.BUCKET_NAME;
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default
const ALLOWED_TYPES = (process.env.ALLOWED_TYPES || 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/avi,video/mov,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain').split(',');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

function createResponse(statusCode, body, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
}

function validateJWTClaims(requestContext) {
  if (!requestContext || !requestContext.authorizer || !requestContext.authorizer.claims) {
    throw new Error('Missing JWT claims in request context');
  }
  const claims = requestContext.authorizer.claims;
  if (!claims.sub || !claims.email) {
    throw new Error('Invalid JWT claims: missing required fields');
  }
  return claims;
}

function validateApprovedUsersGroup(claims) {
  console.log('Validating user groups. Claims:', JSON.stringify(claims, null, 2));
  
  const userGroups = claims['cognito:groups'];
  console.log('User groups from claims:', userGroups);
  
  // Handle different formats of groups
  let groups = [];
  if (Array.isArray(userGroups)) {
    groups = userGroups;
  } else if (typeof userGroups === 'string') {
    groups = [userGroups];
  } else if (userGroups) {
    // Handle comma-separated string or other formats
    groups = userGroups.toString().split(',').map(g => g.trim());
  }
  
  console.log('Processed groups array:', groups);
  
  if (!groups.includes('ApprovedUsers')) {
    console.error('User is not in ApprovedUsers group. Available groups:', groups);
    throw new Error('User is not in ApprovedUsers group');
  }
  
  console.log('User validation successful - user is in ApprovedUsers group');
}

function createErrorResponse(statusCode, error, message, code = null) {
  const errorBody = {
    error,
    message,
    timestamp: new Date().toISOString()
  };
  if (code) {
    errorBody.code = code;
  }
  return createResponse(statusCode, errorBody);
}

function parseMultipartData(body, contentType) {
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }

  // Extract boundary from content-type header
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    throw new Error('Missing boundary in Content-Type header');
  }
  
  const boundary = boundaryMatch[1].trim();
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
  
  // Convert body to buffer if it's base64 encoded (API Gateway)
  let bodyBuffer;
  if (typeof body === 'string') {
    bodyBuffer = Buffer.from(body, 'base64');
  } else {
    bodyBuffer = Buffer.from(body);
  }

  const files = [];
  const fields = {};
  
  // Split by boundary
  let currentPos = 0;
  
  while (currentPos < bodyBuffer.length) {
    // Find next boundary
    const boundaryPos = bodyBuffer.indexOf(boundaryBuffer, currentPos);
    if (boundaryPos === -1) break;
    
    // Move past boundary and CRLF
    currentPos = boundaryPos + boundaryBuffer.length;
    
    // Skip CRLF after boundary
    if (bodyBuffer[currentPos] === 0x0D && bodyBuffer[currentPos + 1] === 0x0A) {
      currentPos += 2;
    }
    
    // Check if this is the end boundary
    if (bodyBuffer.indexOf(endBoundaryBuffer, boundaryPos) === boundaryPos) {
      break;
    }
    
    // Find the end of headers (double CRLF)
    const headerEndPos = bodyBuffer.indexOf(Buffer.from('\r\n\r\n'), currentPos);
    if (headerEndPos === -1) break;
    
    // Extract headers
    const headerSection = bodyBuffer.slice(currentPos, headerEndPos).toString('utf8');
    const headers = {};
    
    headerSection.split('\r\n').forEach(line => {
      const colonPos = line.indexOf(':');
      if (colonPos > 0) {
        const key = line.slice(0, colonPos).trim().toLowerCase();
        const value = line.slice(colonPos + 1).trim();
        headers[key] = value;
      }
    });
    
    // Move past headers
    currentPos = headerEndPos + 4; // +4 for \r\n\r\n
    
    // Find next boundary to determine content end
    const nextBoundaryPos = bodyBuffer.indexOf(boundaryBuffer, currentPos);
    let contentEnd;
    if (nextBoundaryPos === -1) {
      contentEnd = bodyBuffer.length;
    } else {
      // Content ends 2 bytes before boundary (for \r\n)
      contentEnd = nextBoundaryPos - 2;
    }
    
    // Extract content
    const content = bodyBuffer.slice(currentPos, contentEnd);
    
    // Parse Content-Disposition header
    const contentDisposition = headers['content-disposition'];
    if (contentDisposition) {
      const nameMatch = contentDisposition.match(/name="([^"]+)"/);
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      
      if (filenameMatch && nameMatch) {
        // This is a file
        files.push({
          fieldname: nameMatch[1],
          filename: filenameMatch[1],
          content: content,
          contentType: headers['content-type'] || 'application/octet-stream'
        });
      } else if (nameMatch) {
        // This is a regular field
        fields[nameMatch[1]] = content.toString('utf8');
      }
    }
    
    currentPos = nextBoundaryPos;
  }
  
  return { files, fields };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, { message: 'CORS preflight successful' });
  }

  if (event.httpMethod !== 'POST') {
    return createResponse(405, { error: 'Method Not Allowed' });
  }

  if (!BUCKET_NAME) {
    return createResponse(500, { error: 'Server configuration error: Bucket name missing' });
  }

  let claims;
  try {
    claims = validateJWTClaims(event.requestContext);
    console.log('JWT claims validated successfully');
    validateApprovedUsersGroup(claims);
    console.log('User group validation successful');
  } catch (err) {
    console.error('Authentication/authorization error:', err.message);
    return createErrorResponse(403, 'Forbidden', err.message);
  }

  // Check if this is a list request or presigned URL request (JSON body with action)
  const contentType = event.headers['Content-Type'] || event.headers['content-type'];
  if (contentType && contentType.includes('application/json')) {
    try {
      const body = JSON.parse(event.body);
      if (body.action === 'list') {
        return handleListMedia(body.category, claims);
      }
      if (body.action === 'presigned-url') {
        return handlePresignedUrl(body, claims);
      }
    } catch (err) {
      // If JSON parsing fails, continue to file upload logic
    }
  }

  // Handle file upload (existing logic)
  return handleFileUpload(event, claims);
}

async function handlePresignedUrl(body, claims) {
  const { filename, contentType, fileSize } = body;
  
  if (!filename || !contentType) {
    return createErrorResponse(400, 'Bad Request', 'Filename and contentType are required');
  }
  
  if (!ALLOWED_TYPES.includes(contentType)) {
    return createErrorResponse(400, 'Bad Request', 'File type not allowed');
  }
  
  // For large files, allow up to 500MB
  const maxSize = 500 * 1024 * 1024; // 500MB
  if (fileSize && fileSize > maxSize) {
    return createErrorResponse(400, 'Bad Request', 'File size exceeds 500MB limit');
  }
  
  try {
    const key = `media/${determineCategory(contentType)}/${Date.now()}-${filename}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: {
        'uploaded-by': claims.email || claims['cognito:username'] || 'unknown',
        'upload-timestamp': new Date().toISOString()
      }
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    
    return createResponse(200, {
      presignedUrl,
      key,
      message: 'Presigned URL generated successfully'
    });
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    return createErrorResponse(500, 'Internal Server Error', 'Failed to generate presigned URL');
  }
}

function determineCategory(contentType) {
  if (contentType.startsWith('image/')) return 'pictures';
  if (contentType.startsWith('video/')) return 'videos';
  return 'documents';
}

async function handleListMedia(category, claims) {
  if (!category || !['pictures', 'videos', 'documents'].includes(category)) {
    return createErrorResponse(400, 'Bad Request', 'Valid category required: pictures, videos, or documents');
  }

  try {
    const prefix = `media/${category}/`;
    
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 100
    });

    const response = await s3Client.send(listCommand);
    
    if (!response.Contents) {
      return createResponse(200, []);
    }

    // Generate signed URLs for each item
    const mediaItems = await Promise.all(
      response.Contents.map(async (item) => {
        const getObjectCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: item.Key
        });
        
        const signedUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
        
        return {
          id: item.Key,
          filename: item.Key.split('/').pop(),
          title: item.Key.split('/').pop(),
          uploadDate: item.LastModified.toISOString(),
          fileSize: item.Size,
          contentType: getContentTypeFromKey(item.Key),
          signedUrl: signedUrl,
          category: category
        };
      })
    );

    return createResponse(200, mediaItems);
  } catch (err) {
    console.error('Error listing media:', err);
    return createErrorResponse(500, 'Internal Server Error', 'Failed to retrieve media items');
  }
}

function getContentTypeFromKey(key) {
  const extension = key.split('.').pop()?.toLowerCase();
  const contentTypeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'avi': 'video/avi',
    'mov': 'video/mov',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain'
  };
  return contentTypeMap[extension] || 'application/octet-stream';
}

async function handleFileUpload(event, claims) {

  let result;
  try {
    const contentType = event.headers['Content-Type'] || event.headers['content-type'];
    result = parseMultipartData(event.body, contentType);
  } catch (err) {
    console.error('Error processing upload:', err);
    return createErrorResponse(400, 'Bad Request', 'Invalid multipart/form-data');
  }

  if (!result.files || result.files.length === 0) {
    return createErrorResponse(400, 'Bad Request', 'No file uploaded');
  }

  const file = result.files[0];

  if (file.content.length > MAX_FILE_SIZE) {
    return createErrorResponse(400, 'Bad Request', 'File size exceeds limit');
  }

  if (!ALLOWED_TYPES.includes(file.contentType)) {
    return createErrorResponse(400, 'Bad Request', 'File type not allowed');
  }

  // Determine S3 prefix based on file type
  let prefix = 'media/documents/'; // Default to documents
  if (file.contentType.startsWith('image/')) {
    prefix = 'media/pictures/';
  } else if (file.contentType.startsWith('video/')) {
    prefix = 'media/videos/';
  }

  const key = `${prefix}${Date.now()}_${file.filename}`;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.content,
      ContentType: file.contentType,
      Metadata: {
        uploadedBy: claims.email
      },
      ServerSideEncryption: 'AES256'
    }));

    // Generate signed URL for immediate access
    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const signedUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });

    return createResponse(200, {
      message: 'Upload successful',
      key,
      filename: file.filename,
      contentType: file.contentType,
      size: file.content.length,
      url: signedUrl
    });
  } catch (err) {
    console.error('Error uploading to S3:', err);
    return createErrorResponse(500, 'Internal Server Error', 'An unexpected error occurred while processing the request');
  }
};