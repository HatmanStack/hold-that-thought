import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID || "";
const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || "";


// You could add a similar check for the secret key if needed:
// console.log(`AWS Credentials Check: Secret Access Key is ${secretAccessKey ? 'LOADED' : 'MISSING'}.`);
// Never log the keys themselves.

const lambdaClient = new LambdaClient({
    region: "us-west-2", // Ensure this is the correct region for your Lambda
    credentials: {
      accessKeyId: "",
      secretAccessKey: "",
  },
});

const FUNC = "hold-that-thought-lambda";

export async function downloadSourcePdf(): Promise<void> {
  const currentUrl = new URL(window.location.href);
  const sanitizedTitle = decodeURIComponent(currentUrl.pathname);
  

    // Log the result of sanitization
    console.log("Sanitized Title derived from URL Path:", sanitizedTitle);

  try {
    // Construct the payload for the Lambda function
    const payload = {
      type: "download",
      title: sanitizedTitle,
    };

    // Invoke the Lambda function
    const command = new InvokeCommand({
      FunctionName: FUNC,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (!response.Payload) {
      throw new Error("No response payload from Lambda");
  }
  
  const decoder = new TextDecoder();  
  const responsePayloadString = decoder.decode(response.Payload);

  const responsePayload = JSON.parse(responsePayloadString);

// Check if the Lambda execution was successful
if (responsePayload.statusCode !== 200) {
  throw new Error(`Lambda returned error status: ${responsePayload.statusCode}`);
}

// The body is a JSON string that needs to be parsed again
const responseBody = JSON.parse(responsePayload.body);

console.log("Lambda response body:", responseBody);

// Now you can access the downloadUrl and fileNameSuggestion
if (!responseBody.downloadUrl) {
  throw new Error(`Lambda response did not contain a download URL. Message: ${responseBody.message || 'N/A'}`);
}

const downloadUrl = responseBody.downloadUrl;
const suggestedFileName = responseBody.fileNameSuggestion || `${sanitizedTitle}.pdf`;

  console.log("Received download URL:", downloadUrl);
  console.log("Suggested filename:", suggestedFileName);
  
  // --- Trigger download using the presigned URL ---
  const a = document.createElement("a");
  a.href = downloadUrl; // Use the SIGNED URL here
  a.download = suggestedFileName; // Set the filename for the user
  a.target = "_blank"; // Open in a new tab (optional)
  document.body.appendChild(a); // Append link to body
  a.click(); // Simulate click to trigger download
  
  // Clean up
  document.body.removeChild(a); // Remove link from body
  // No need for window.URL.createObjectURL or revokeObjectURL
  
  console.log("Download initiated.");
  } catch (error) {
    console.error("Error downloading PDF:", error);
  }
}

export async function getMarkdownContent(path: string): Promise<string> {
  const currentUrl = new URL(window.location.href);
  const sanitizedTitle = decodeURIComponent(currentUrl.pathname);
  

    // Log the result of sanitization
    console.log("Sanitized Title derived from URL Path:", sanitizedTitle);

  try {
    // Construct the payload for the Lambda function
    const payload = {
      type: "downloadMD",
      title: sanitizedTitle,
    };
    
    const command = new InvokeCommand({
      FunctionName: FUNC,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (!response.Payload) {
      throw new Error("No response payload from Lambda");
  }
  
  const decoder = new TextDecoder();  
  const responsePayloadString = decoder.decode(response.Payload);

  const responsePayload = JSON.parse(responsePayloadString);

    // Check if the Lambda execution was successful
    if (responsePayload.statusCode !== 200) {
      throw new Error(`Lambda returned error status: ${responsePayload.statusCode}`);
    }

    // The body is a JSON string that needs to be parsed again
    const responseBody = JSON.parse(responsePayload.body);

    console.log("Lambda response body:", responseBody);
    if (!responseBody.downloadUrl) {
      throw new Error(`Failed to load markdown file: ${responseBody.statusText}`);
    }
    const markdownText = responseBody.downloadUrl;
    return await markdownText; // Assuming the response is text
  } catch (error) {
    console.error('Error loading markdown content:', error);
    throw error;
  }
}

/**
 * Updates the markdown content for a given post
 * @param path The post path from the URL
 * @param content The new markdown content
 * @returns Boolean indicating success
 */
export async function saveMarkdownContent(content: string): Promise<boolean> {
  
    const currentUrl = new URL(window.location.href);
  const sanitizedTitle = decodeURIComponent(currentUrl.pathname);
  

    // Log the result of sanitization
    console.log("Sanitized Title derived from URL Path:", sanitizedTitle);
    
    try {
      // Construct the payload for the Lambda function
      const payload = {
        type: "update",
        title: sanitizedTitle,
        content: content,
      };
      
      const command = new InvokeCommand({
        FunctionName: FUNC,
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      });
  
      const response = await lambdaClient.send(command);
  
      if (!response.Payload) {
        throw new Error("No response payload from Lambda");
      }
    
    return true;
  } catch (error) {
    console.error('Error saving markdown content:', error);
    throw error;
  }
}

export async function restartEC2(): Promise<boolean> {
  const currentUrl = new URL(window.location.href);
  const sanitizedTitle = decodeURIComponent(currentUrl.pathname);
  

    // Log the result of sanitization
    console.log("Rebuilding Site:", sanitizedTitle);

  try {
    // Construct the payload for the Lambda function
    const payload = {
      type: "deploy",
      title: sanitizedTitle,
    };
    
    const command = new InvokeCommand({
      FunctionName: FUNC,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (!response.Payload) {
      throw new Error("No response payload from Lambda");
    }
  
  return true;
} catch (error) {
  console.error('Error rebuilding Site:', error);
  throw error;
}
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = error => reject(error);
  });
}

export async function addLetterLambda(files: File | File[]): Promise<string> {
  try {
    // Handle both single file and array of files
    const filesArray = Array.isArray(files) ? files : [files];
    
    // Create an array of base64 encoded file data
    const filePromises = filesArray.map(async (file) => {
      const base64 = await fileToBase64(file);
      return {
        fileName: file.name,
        contentType: file.type,
        fileData: base64,
        size: Math.round(file.size / 1024) // Size in KB for logging
      };
    });
    
    // Wait for all files to be converted to base64
    const fileData = await Promise.all(filePromises);
    
    // Log info about the batch
    console.log(`Uploading ${fileData.length} files in batch:`);
    fileData.forEach(file => {
      console.log(`- ${file.fileName} (${file.size} KB)`);
    });
    
    // Construct the payload for the Lambda function
    const payload = {
      type: "create",
      files: fileData
    };
    
    const command = new InvokeCommand({
      FunctionName: FUNC,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (!response.Payload) {
      throw new Error("No response payload from Lambda");
    }
  
    const decoder = new TextDecoder();  
    const responsePayloadString = decoder.decode(response.Payload);
    const responsePayload = JSON.parse(responsePayloadString);

    // Check if the Lambda execution was successful
    if (responsePayload.statusCode !== 200) {
      throw new Error(`Lambda returned error status: ${responsePayload.statusCode}`);
    }

    // The body is a JSON string that needs to be parsed again
    const responseBody = JSON.parse(responsePayload.body);
    console.log("Lambda response body:", responseBody);
    if (!responseBody.imageUrl) {
      throw new Error(`Failed to upload image: ${responseBody.message || 'Unknown error'}`);
    }
 
    return "success";
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}