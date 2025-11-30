import { updateS3Items, getS3PdfKeys, getPresignedUrlForPdf, getMarkdownContent, startec2 } from './utils/s3_update.js';
import { callGoogleGenAIOCRBatch } from './utils/gemini_api.js';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event, context) => {
  if (!BUCKET_NAME) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server configuration error: Bucket name missing.' }),
    };
  }

  try {
    const task = event;

    if (!task || typeof task !== 'object') {
      throw new Error(`Invalid payload received. Expected an object, got: ${typeof task}`);
    }
    if (!task.type) {
      throw new Error("Task object missing 'type' property.");
    }

    if (task.type === "update") {
      if (!task.title || typeof task.content === 'undefined') {
        throw new Error("Missing 'name' or 'content' for update task.");
      }

      const items = [
        { key: `urara${task.title}+page.svelte.md`, body: task.content }
      ];
      await updateS3Items(BUCKET_NAME, items);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully updated ${task.title}` }),
      };
    }

    else if (task.type === "create") {
      if (!Array.isArray(task.files) || task.files.length === 0) {
        throw new Error("Missing or empty 'files' array for create task.");
      }

      const ocrResult = await callGoogleGenAIOCRBatch(task.files)
      const holder = ocrResult.split('|||||');
      const lines = holder[0].split('\n');
      const middleLines = lines.slice(1, -1);
      const markdown = middleLines.join('\n');
      const title = holder[1].trim().replace(/`/g, '');
      const markdownFilePath = `/tmp/${title}.md`;
      fs.writeFileSync(markdownFilePath, markdown);

      const itemsToUpload = [
        {
          key: `urara/${title}/+page.svelte.md`,
          body: fs.readFileSync(markdownFilePath)
        },
        {
          key: `urara/${title}/document.pdf`,
          body: fs.readFileSync('/tmp/final_merged_document.pdf')
        }
      ];

      await updateS3Items(BUCKET_NAME, itemsToUpload);
      await startec2();
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully created entry for ${title}` }),
      };
    }
    else if (task.type === "deploy") {
      try {
        await startec2();
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Successfully initiated start for instance`,
          }),
        };

      } catch (error) {
        console.error(`Error during Lambda execution:`, error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: "Lambda execution failed",
            error: error.message,
            details: error,
          }),
        };
      }
    }

    else if (task.type === "downloadMD") {
      const titleForPrefix = task.title || '';
      if (!titleForPrefix) {
        throw new Error("Missing 'title' for download task.");
      }
      const targetKey = `urara${titleForPrefix}+page.svelte.md`;

      const downloadUrl = await getMarkdownContent(BUCKET_NAME, targetKey);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Download URL generated successfully.',
          downloadUrl: downloadUrl
        }),
      };
    }
    else if (task.type === "download") {
      const titleForPrefix = task.title || '';
      if (!titleForPrefix) {
        throw new Error("Missing 'title' for download task.");
      }
      const prefix = `urara${titleForPrefix}`;

      const pdfKeys = await getS3PdfKeys(BUCKET_NAME, prefix);

      if (!pdfKeys || pdfKeys.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'No PDF document found for that title.' }),
        };
      }

      const targetKey = pdfKeys[0];

      const downloadUrl = await getPresignedUrlForPdf(BUCKET_NAME, targetKey);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Download URL generated successfully.',
          downloadUrl: downloadUrl,
          fileNameSuggestion: path.basename(targetKey)
        }),
      };
    }
    else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Unknown task type: ${task.type}` }),
      };
    }

  } catch (error) {
    console.error("Error processing Lambda event:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'An error occurred while processing the request.',
      }),
    };
  }
};
