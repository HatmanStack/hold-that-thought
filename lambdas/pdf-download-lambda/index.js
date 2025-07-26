import { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-west-2" });

// Environment variables
const BUCKET_NAME = process.env.BUCKET_NAME;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Validate environment variables
if (!BUCKET_NAME) {
    console.error("Error: BUCKET_NAME environment variable is not set.");
}

/**
 * Creates API Gateway compatible response with CORS headers
 */
function createAPIGatewayResponse(statusCode, body, headers = {}, isBase64 = false) {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': CORS_ORIGIN,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
            ...headers
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        isBase64Encoded: isBase64
    };
}

/**
 * Creates error response with consistent format
 */
function createErrorResponse(statusCode, error, message, code = null) {
    const errorBody = {
        error,
        message,
        timestamp: new Date().toISOString()
    };
    
    if (code) {
        errorBody.code = code;
    }
    
    return createAPIGatewayResponse(statusCode, errorBody, { 'Content-Type': 'application/json' });
}

/**
 * Gets markdown file from S3
 */
async function getMarkdownContent(bucketName, key) {
    try {
        // Remove leading slash and construct path in urara directory
        const cleanKey = key.replace(/^\//, '');
        const mdKey = `urara/${cleanKey}/+page.svelte.md`;
        console.log(`[S3] Getting markdown file from bucket ${bucketName} with key ${mdKey}`);
        
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: mdKey
        });

        const response = await s3Client.send(command);
        const content = await response.Body.transformToString();
        console.log("[S3] Successfully retrieved markdown content");
        
        return content;
    } catch (error) {
        console.error("[S3] Error getting markdown content:", error);
        throw new Error("Failed to get markdown content from S3");
    }
}

/**
 * Updates markdown file in S3
 */
async function updateMarkdownContent(bucketName, key, content) {
    try {
        // Remove leading slash and construct path in urara directory
        const cleanKey = key.replace(/^\//, '');
        const mdKey = `urara/${cleanKey}/+page.svelte.md`;
        console.log(`[S3] Updating markdown file in bucket ${bucketName} with key ${mdKey}`);
        
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: mdKey,
            Body: content,
            ContentType: 'text/markdown'
        });

        await s3Client.send(command);
        console.log("[S3] Successfully updated markdown content");
        
        return true;
    } catch (error) {
        console.error("[S3] Error updating markdown content:", error);
        throw new Error("Failed to update markdown content in S3");
    }
}

/**
 * Gets PDF keys from S3 bucket with given prefix
 */
async function getS3PdfKeys(bucketName, prefix) {
    try {
        const searchPrefix = prefix.replace('/*.pdf', '/');
        console.log(`[S3] Listing objects in bucket ${bucketName} with prefix ${searchPrefix}`);
        
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: searchPrefix
        });

        const response = await s3Client.send(command);
        console.log("[S3] ListObjects response:", JSON.stringify(response, null, 2));
        
        if (!response.Contents) {
            console.log("[S3] No contents found in response");
            return [];
        }

        const pdfKeys = response.Contents
            .filter(obj => obj.Key && obj.Key.toLowerCase().endsWith('.pdf'))
            .map(obj => obj.Key);

        console.log("[S3] Found PDF keys:", pdfKeys);
        return pdfKeys;
    } catch (error) {
        console.error("[S3] Error listing objects:", error);
        throw new Error("Failed to list PDF files from S3");
    }
}

/**
 * Downloads PDF from S3 and returns as binary buffer
 */
async function downloadPdfFromS3(bucketName, key) {
    try {
        console.log(`[S3] Downloading PDF from bucket ${bucketName}, key ${key}`);
        
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        const response = await s3Client.send(command);
        
        // Convert stream to buffer directly
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        console.log(`[S3] Successfully downloaded PDF, size: ${buffer.length} bytes`);
        return buffer;
    } catch (error) {
        console.error("[S3] Error downloading PDF:", error);
        throw new Error("Failed to download PDF");
    }
}

/**
 * Handle markdown request
 */
async function handleMarkdownRequest(requestData) {
    try {
        console.log('[Lambda] Handling markdown request:', requestData);
        
        if (requestData.type === 'markdown') {
            // Handle update
            const { key, content } = requestData;
            if (!key || !content) {
                console.error('[Lambda] Missing required fields:', { key, contentLength: content?.length });
                throw new Error('Missing required fields: key and content');
            }

            // Remove leading slash and construct path in urara directory
            const cleanKey = key.replace(/^\//, '');
            const mdKey = `urara/${cleanKey}/+page.svelte.md`;
            console.log(`[S3] Updating markdown file in bucket ${BUCKET_NAME} with key ${mdKey}`);
            
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: mdKey,
                Body: content,
                ContentType: 'text/markdown'
            });

            await s3Client.send(command);
            console.log("[S3] Successfully updated markdown content");
            
            return createAPIGatewayResponse(200, {
                success: true,
                message: 'Content updated successfully',
                key: mdKey,
                timestamp: new Date().toISOString()
            });
        } else {
            // Handle read
            const mdContent = await getMarkdownContent(BUCKET_NAME, requestData.key);
            return createAPIGatewayResponse(200, {
                content: mdContent,
                generatedAt: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("[Lambda] Error handling markdown request:", error);
        return createErrorResponse(error.message.includes('Missing') ? 400 : 500, 
            error.message.includes('Missing') ? "Bad Request" : "Internal Server Error",
            error.message);
    }
}

/**
 * Handle PDF download request
 */
async function handlePdfRequest(requestedKey) {
    try {
        const cleanKey = requestedKey.replace(/^\//, '').replace(/\/$/, '');
        const prefix = `urara/${cleanKey}/*.pdf`;
        console.log("[Lambda] Using S3 prefix for PDF:", prefix);

        const pdfKeys = await getS3PdfKeys(BUCKET_NAME, prefix);
        console.log("[Lambda] Found PDF keys:", pdfKeys);

        if (!pdfKeys || pdfKeys.length === 0) {
            console.log("[Lambda] No PDF files found for prefix:", prefix);
            return createErrorResponse(404, "Not Found", "No PDF document found");
        }

        const targetKey = pdfKeys[0];
        console.log("[Lambda] Using target key:", targetKey);

        const pdfBuffer = await downloadPdfFromS3(BUCKET_NAME, targetKey);
        
        const pathParts = targetKey.split('/');
        const letterName = pathParts.length >= 3 ? pathParts.slice(1, -1).join(' ') : 'letter';
        const safeFileName = `${letterName}.pdf`;
        
        // Return binary data with proper headers
        return createAPIGatewayResponse(200, pdfBuffer.toString('base64'), {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeFileName}"`,
            'Content-Length': pdfBuffer.length.toString(),
            'Cache-Control': 'no-cache'
        }, true);
    } catch (error) {
        console.error("[Lambda] Error handling PDF request:", error);
        return createErrorResponse(500, "Internal Server Error", "Failed to process PDF download");
    }
}

/**
 * Extract request data from event
 */
function getRequestData(event) {
    if (event && typeof event.key === 'string') {
        return event;
    }
    
    if (event.body) {
        return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }
    
    throw new Error('Invalid request format');
}

/**
 * Main Lambda handler
 */
export const handler = async (event, context) => {
    console.log("[Lambda] Handler started");
    console.log("[Lambda] Event:", JSON.stringify(event, null, 2));
    console.log("[Lambda] Environment:", {
        BUCKET_NAME,
        REGION: process.env.AWS_REGION,
        CORS_ORIGIN
    });

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return createAPIGatewayResponse(200, { message: 'CORS preflight successful' });
    }

    if (!BUCKET_NAME) {
        console.error("[Lambda] BUCKET_NAME environment variable is not set");
        return createErrorResponse(500, "Configuration Error", "Server configuration error: Bucket name missing");
    }

    try {
        let requestData;
        try {
            requestData = getRequestData(event);
            console.log("[Lambda] Request data:", requestData);
            
            if (!requestData.key && !requestData.title) {
                console.error("[Lambda] Missing key/title in request data");
                return createErrorResponse(400, "Bad Request", "Missing required field: key or title");
            }
        } catch (error) {
            console.error("[Lambda] Error parsing request data:", error);
            return createErrorResponse(400, "Bad Request", "Invalid request format");
        }

        if (requestData.type === 'markdown' || requestData.type === 'update') {
            return await handleMarkdownRequest(requestData);
        } else {
            return await handlePdfRequest(requestData.key);
        }

    } catch (error) {
        console.error("[Lambda] Error processing request:", error);
        return createErrorResponse(500, "Internal Server Error", "An unexpected error occurred while processing the request");
    }
};
