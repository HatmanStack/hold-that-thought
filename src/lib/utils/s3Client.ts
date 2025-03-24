import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-east-2", 
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || ''
  }, useAccelerateEndpoint: false,
  forcePathStyle: true,
  customUserAgent: 'SvelteKit-S3-Client'
});

const BUCKET_NAME = "round-robin-source"; 

export async function downloadSourcePdf(postTitle: string): Promise<void> {
  if (!postTitle) return;
  
  try {
    const sanitizedTitle = postTitle.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const s3Prefix = `source/${sanitizedTitle}/`;
    console.log('s3Prefix:', s3Prefix);
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: s3Prefix,
    }));
    
    console.log('listResponse:', listResponse);
    // Find the PDF file
    const pdfKey = listResponse.Contents?.find(item => 
      item.Key?.toLowerCase().endsWith('.pdf')
    )?.Key;
    
    if (!pdfKey) {
      console.error(`No PDF found in ${s3Prefix}`);
      return;
    }

    const getResponse = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: pdfKey
    }));
    
    // Convert to blob and download
    const blob = await new Response(getResponse.Body as ReadableStream).blob();
    const url = window.URL.createObjectURL(blob);
    const fileName = pdfKey.split('/').pop() || `${sanitizedTitle}.pdf`;
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (error) {
    console.error('Error downloading PDF:', error);
  }
}