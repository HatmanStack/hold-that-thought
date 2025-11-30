import { handler } from '../index.js';

// Mock API Gateway event for successful request
const mockSuccessEvent = {
    httpMethod: 'GET',
    requestContext: {
        authorizer: {
            claims: {
                sub: 'test-user-123',
                email: 'test@example.com',
                'cognito:groups': 'ApprovedUsers'
            }
        }
    },
    queryStringParameters: {
        filename: 'test-document.pdf'
    },
    headers: {
        'Authorization': 'Bearer mock-jwt-token'
    }
};

// Mock API Gateway event for unauthorized request (missing claims)
const mockUnauthorizedEvent = {
    httpMethod: 'GET',
    requestContext: {},
    queryStringParameters: null,
    headers: {}
};

// Mock API Gateway event for forbidden request (wrong group)
const mockForbiddenEvent = {
    httpMethod: 'GET',
    requestContext: {
        authorizer: {
            claims: {
                sub: 'test-user-456',
                email: 'test2@example.com',
                'cognito:groups': 'RegularUsers'
            }
        }
    },
    queryStringParameters: null,
    headers: {
        'Authorization': 'Bearer mock-jwt-token'
    }
};

// Mock API Gateway event for CORS preflight
const mockOptionsEvent = {
    httpMethod: 'OPTIONS',
    requestContext: {},
    queryStringParameters: null,
    headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
    }
};

// Mock API Gateway event for wrong HTTP method
const mockWrongMethodEvent = {
    httpMethod: 'POST',
    requestContext: {
        authorizer: {
            claims: {
                sub: 'test-user-123',
                email: 'test@example.com',
                'cognito:groups': 'ApprovedUsers'
            }
        }
    },
    queryStringParameters: null,
    headers: {}
};

// Mock context
const mockContext = {
    functionName: 'pdf-download-lambda',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:pdf-download-lambda',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id'
};

// Test function
async function runTests() {
    console.log('🧪 Starting PDF Download Lambda Tests\n');

    // Set environment variables for testing
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-west-2';
    process.env.CORS_ORIGIN = '*';

    const tests = [
        {
            name: 'CORS Preflight Request',
            event: mockOptionsEvent,
            expectedStatus: 200
        },
        {
            name: 'Wrong HTTP Method',
            event: mockWrongMethodEvent,
            expectedStatus: 405
        },
        {
            name: 'Unauthorized Request (Missing Claims)',
            event: mockUnauthorizedEvent,
            expectedStatus: 401
        },
        {
            name: 'Forbidden Request (Wrong Group)',
            event: mockForbiddenEvent,
            expectedStatus: 403
        },
        {
            name: 'Successful Request (Mock S3 Error Expected)',
            event: mockSuccessEvent,
            expectedStatus: 500 // Will fail due to mock S3, but should handle gracefully
        }
    ];

    for (const test of tests) {
        console.log(`🔍 Testing: ${test.name}`);
        
        try {
            const result = await handler(test.event, mockContext);
            const parsedBody = JSON.parse(result.body);
            
            console.log(`   Status: ${result.statusCode} (Expected: ${test.expectedStatus})`);
            console.log(`   Response: ${JSON.stringify(parsedBody, null, 2)}`);
            
            if (result.statusCode === test.expectedStatus) {
                console.log('   ✅ PASS\n');
            } else {
                console.log('   ❌ FAIL - Status code mismatch\n');
            }
            
        } catch (error) {
            console.log(`   ❌ FAIL - Exception: ${error.message}\n`);
        }
    }

    console.log('🏁 Tests completed');
}

// Test environment variable validation
async function testEnvironmentValidation() {
    console.log('🧪 Testing Environment Variable Validation\n');
    
    // Remove BUCKET_NAME to test validation
    delete process.env.BUCKET_NAME;
    
    try {
        const result = await handler(mockSuccessEvent, mockContext);
        const parsedBody = JSON.parse(result.body);
        
        console.log('🔍 Testing: Missing BUCKET_NAME');
        console.log(`   Status: ${result.statusCode} (Expected: 500)`);
        console.log(`   Response: ${JSON.stringify(parsedBody, null, 2)}`);
        
        if (result.statusCode === 500 && parsedBody.error === 'Configuration Error') {
            console.log('   ✅ PASS - Correctly handled missing environment variable\n');
        } else {
            console.log('   ❌ FAIL - Did not handle missing environment variable correctly\n');
        }
        
    } catch (error) {
        console.log(`   ❌ FAIL - Exception: ${error.message}\n`);
    }
}

// Run all tests
async function main() {
    await testEnvironmentValidation();
    await runTests();
}

// Execute tests if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { runTests, testEnvironmentValidation };