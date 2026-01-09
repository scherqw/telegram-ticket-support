import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import axios from 'axios';
import * as path from 'path';

// EXPORTED so other files can use it
export const BUCKET_NAME = 'telegram-media';

/**
 * Initialize S3 client for LocalStack
 */
function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT || "http://localstack:4566",
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    },
    forcePathStyle: true, // Required for LocalStack
  });
}

/**
 * Ensures the S3 bucket exists, creates it if not
 */
export async function ensureBucketExists(): Promise<void> {
  const s3 = getS3Client();
  
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ S3 bucket "${BUCKET_NAME}" exists`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`📦 Creating S3 bucket "${BUCKET_NAME}"...`);
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`✅ S3 bucket "${BUCKET_NAME}" created`);
    } else {
      console.error('❌ Error checking S3 bucket:', error);
      throw error;
    }
  }
}

/**
 * Downloads a file from Telegram and uploads it to S3
 * * @param botToken - Telegram bot token
 * @param fileId - Telegram file ID
 * @param ticketId - Ticket ID for organizing files
 * @param mediaType - Type of media (photo, document, etc.)
 * @returns S3 key and URL
 */
export async function downloadAndUploadToS3(
  botToken: string,
  fileId: string,
  ticketId: string,
  mediaType: string
): Promise<{ s3Key: string; s3Url: string }> {
  try {
    // Step 1: Get file information from Telegram
    const fileInfoResponse = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    
    if (!fileInfoResponse.data.ok) {
      throw new Error('Failed to get file info from Telegram');
    }
    
    const filePath = fileInfoResponse.data.result.file_path;
    const fileExtension = path.extname(filePath) || getDefaultExtension(mediaType);
    const fileName = `${mediaType}_${Date.now()}${fileExtension}`;
    
    // Step 2: Download file from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const fileBuffer = Buffer.from(fileResponse.data);
    
    console.log(`📥 Downloaded ${fileName} (${fileBuffer.length} bytes) from Telegram`);
    
    // Step 3: Upload to S3
    const s3Key = `tickets/${ticketId}/${fileName}`;
    const s3 = getS3Client();
    
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: getContentType(mediaType, fileExtension),
    }));
    
    console.log(`📤 Uploaded to S3: ${s3Key}`);
    
    // Step 4: Generate Public S3 URL (Fix applied here)
    // We use S3_PUBLIC_ENDPOINT for the display URL, falling back to localhost
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || "http://localhost:4566";
    const s3Url = `${publicEndpoint}/${BUCKET_NAME}/${s3Key}`;
    
    return { s3Key, s3Url };
    
  } catch (error: any) {
    console.error('❌ Error downloading/uploading file:', error.message);
    throw error;
  }
}

/**
 * Gets default file extension based on media type
 */
function getDefaultExtension(mediaType: string): string {
  const extensions: Record<string, string> = {
    photo: '.jpg',
    video: '.mp4',
    audio: '.mp3',
    voice: '.ogg',
    document: '.bin',
    sticker: '.webp'
  };
  return extensions[mediaType] || '.bin';
}

/**
 * Gets content type based on media type and extension
 */
function getContentType(mediaType: string, extension: string): string {
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
  };
  
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}