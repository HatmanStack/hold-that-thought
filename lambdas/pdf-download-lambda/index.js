import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
 * Creates API Gateway compatible response
 */
function createAPIGatewayResponse(statusCode, body, additionalHeaders = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': CORS_ORIGIN,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            ...additionalHeaders
        },
        body: JSON.stringify(body)
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
    
    return createAPIGatewayResponse(statusCode, errorBody);
}

/**
 * Gets PDF keys from S3 bucket with given prefix
 */
async function getS3PdfKeys(bucketName, prefix) {
    try {
        // Remove the *.pdf from the prefix for the ListObjects call
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

        // Filter for PDF files
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
 * Generates presigned URL for PDF download
 */
async function getPresignedUrlForPdf(bucketName, key, filename) {
    try {
        console.log(`[S3] Generating presigned URL for bucket ${bucketName}, key ${key}`);
        
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${filename}"`
        });

        // Generate presigned URL with 1 hour expiration
        const presignedUrl = await getSignedUrl(s3Client, command, { 
            expiresIn: 3600 
        });

        console.log("[S3] Generated presigned URL:", presignedUrl);
        return presignedUrl;
    } catch (error) {
        console.error("[S3] Error generating presigned URL:", error);
        throw new Error("Failed to generate download URL");
    }
}

/**
 * Extract request data from event
 */
function getRequestData(event) {
    // If event is already the data we need
    if (event && typeof event.key === 'string') {
        return event;
    }
    
    // If event is from API Gateway
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

    // Validate environment variables at runtime
    if (!BUCKET_NAME) {
        console.error("[Lambda] BUCKET_NAME environment variable is not set");
        return createErrorResponse(500, "Configuration Error", "Server configuration error: Bucket name missing");
    }

    try {
        // Handle CORS preflight requests
        if (event.httpMethod === 'OPTIONS') {
            return createAPIGatewayResponse(200, { message: 'CORS preflight successful' });
        }

        // Parse the request data
        let requestedKey;
        try {
            const requestData = getRequestData(event);
            console.log("[Lambda] Request data:", requestData);
            
            requestedKey = requestData.key;
            if (!requestedKey) {
                console.error("[Lambda] Missing key in request data");
                return createErrorResponse(400, "Bad Request", "Missing required field: key");
            }
            
            console.log("[Lambda] Requested key:", requestedKey);
        } catch (error) {
            console.error("[Lambda] Error parsing request data:", error);
            return createErrorResponse(400, "Bad Request", "Invalid request format");
        }

        // Determine the S3 prefix to search for PDFs
        const cleanKey = requestedKey.replace(/^\//, '').replace(/\/$/, '');
        const prefix = `urara/${cleanKey}/*.pdf`;
        console.log("[Lambda] Using S3 prefix:", prefix);

        // Find PDF files in S3
        const pdfKeys = await getS3PdfKeys(BUCKET_NAME, prefix);
        console.log("[Lambda] Found PDF keys:", pdfKeys);

        if (!pdfKeys || pdfKeys.length === 0) {
            console.log("[Lambda] No PDF files found for prefix:", prefix);
            return createErrorResponse(404, "Not Found", "No PDF document found for the requested resource");
        }

        // Use the first found PDF
        const targetKey = pdfKeys[0];
        console.log("[Lambda] Using target key:", targetKey);

        // Generate presigned URL
        const presignedUrl = await getPresignedUrlForPdf(BUCKET_NAME, targetKey);
        console.log("[Lambda] Generated presigned URL successfully");

        // Extract filename from S3 key for suggestion
        const fileNameSuggestion = targetKey.split('/').pop() || 'document.pdf';
        console.log("[Lambda] Using filename suggestion:", fileNameSuggestion);

        // Create successful response
        const responseBody = {
            url: presignedUrl,
            fileNameSuggestion,
            expiresIn: 3600,
            generatedAt: new Date().toISOString()
        };

        console.log("[Lambda] Sending response:", JSON.stringify(responseBody, null, 2));
        return createAPIGatewayResponse(200, responseBody);

    } catch (error) {
        console.error("[Lambda] Error processing request:", error);
        
        // Return appropriate error response based on error type
        if (error.message.includes("Failed to list PDF files") || 
            error.message.includes("Failed to generate download URL")) {
            return createErrorResponse(500, "Internal Server Error", "Failed to process PDF download request");
        }
        
        return createErrorResponse(500, "Internal Server Error", "An unexpected error occurred while processing the request");
    }
};
