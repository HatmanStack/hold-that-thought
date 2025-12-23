const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { mergeFiles } = require('./pdf-utils')
const { parseLetter } = require('./gemini')

const s3 = new S3Client({})
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME
const ARCHIVE_BUCKET = process.env.ARCHIVE_BUCKET

exports.handler = async (event) => {
  const { uploadId, requesterId } = event
  
  if (!uploadId) throw new Error('Missing uploadId')

  try {
    // 1. List files
    const prefix = `temp/${uploadId}/`
    const listCmd = new ListObjectsV2Command({
        Bucket: ARCHIVE_BUCKET,
        Prefix: prefix
    })
    const listRes = await s3.send(listCmd)
    
    if (!listRes.Contents || listRes.Contents.length === 0) {
        throw new Error(`No files found at ${prefix}`)
    }
    
    // Filter and Sort
    const objects = listRes.Contents
        .filter(obj => !obj.Key.endsWith('combined.pdf'))
        .sort((a, b) => {
            const idxA = parseInt(a.Key.split('/').pop().split('.')[0], 10)
            const idxB = parseInt(b.Key.split('/').pop().split('.')[0], 10)
            // Handle NaN - put non-numeric filenames at end
            if (Number.isNaN(idxA) && Number.isNaN(idxB)) return 0
            if (Number.isNaN(idxA)) return 1
            if (Number.isNaN(idxB)) return -1
            return idxA - idxB
        })
        

    // 2. Download files
    const files = []
    for (const obj of objects) {
        const getCmd = new GetObjectCommand({ Bucket: ARCHIVE_BUCKET, Key: obj.Key })
        const res = await s3.send(getCmd)
        const buffer = await streamToBuffer(res.Body)
        
        let type = 'application/octet-stream'
        if (obj.Key.toLowerCase().endsWith('.pdf')) type = 'application/pdf'
        if (obj.Key.toLowerCase().endsWith('.jpg') || obj.Key.toLowerCase().endsWith('.jpeg')) type = 'image/jpeg'
        if (obj.Key.toLowerCase().endsWith('.png')) type = 'image/png'
        
        files.push({ buffer, type })
    }
    
    // 3. Merge
    const combinedPdf = await mergeFiles(files)
    
    // 4. Upload Combined
    const combinedKey = `temp/${uploadId}/combined.pdf`
    await s3.send(new PutObjectCommand({
        Bucket: ARCHIVE_BUCKET,
        Key: combinedKey,
        Body: combinedPdf,
        ContentType: 'application/pdf'
    }))
    
    // 5. Gemini Parse
    const parsedData = await parseLetter(combinedPdf)
    
    // 6. Save Draft
    await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            PK: `DRAFT#${uploadId}`,
            SK: 'METADATA',
            entityType: 'DRAFT_LETTER',
            status: 'REVIEW',
            createdAt: new Date().toISOString(),
            requesterId,
            s3Key: combinedKey,
            parsedData
        }
    }))
    
    return { status: 'success', uploadId }
  } catch (error) {
      console.error('Processing failed:', error)
      // Update status to ERROR in DB?
      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            PK: `DRAFT#${uploadId}`,
            SK: 'METADATA',
            entityType: 'DRAFT_LETTER',
            status: 'ERROR',
            error: error.message,
            createdAt: new Date().toISOString(),
            requesterId
        }
    }))
    throw error
  }
}

const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = []
    stream.on("data", (chunk) => chunks.push(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(Buffer.concat(chunks)))
  })
