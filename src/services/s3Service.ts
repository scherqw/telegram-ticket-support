import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketCors$, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Configure ffmpeg
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

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

  console.log(`🔧 Applying CORS policy to "${BUCKET_NAME}"...`);
  await s3.send(new PutBucketCorsCommand({
    Bucket: BUCKET_NAME,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedOrigins: ["*"],
          ExposeHeaders: ["ETag", "Content-Length", "Content-Type", "Accept-Ranges"],
          MaxAgeSeconds: 3000
        }
      ]
    }
  }));
  console.log(`✅ CORS policy applied`);
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
    // Step 1: Get file info
    const fileInfoResponse = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    
    if (!fileInfoResponse.data.ok) {
      throw new Error('Failed to get file info from Telegram');
    }
    
    const filePath = fileInfoResponse.data.result.file_path;
    let fileExtension = path.extname(filePath) || getDefaultExtension(mediaType);
    let fileName = `${mediaType}_${Date.now()}${fileExtension}`;
    
    // Step 2: Download file
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    let fileBuffer = Buffer.from(fileResponse.data);
    let contentType = getContentType(mediaType, fileExtension);

    console.log(`📥 Downloaded ${fileName} (${fileBuffer.length} bytes)`);
    
    // Step 3: Convert Voice to MP3 (Fix for Safari/Web Playback)
    if (mediaType === 'voice' || (mediaType === 'audio' && fileExtension === '.oga')) {
      console.log(`🔄 Converting ${fileName} to MP3 for web compatibility...`);
      try {
        fileBuffer = await convertToMp3(fileBuffer, fileName);
        
        // Update metadata to reflect MP3
        fileExtension = '.mp3';
        fileName = fileName.replace(/\.[^/.]+$/, ".mp3");
        contentType = 'audio/mpeg';
        
        console.log(`✅ Conversion successful: ${fileName} (${fileBuffer.length} bytes)`);
      } catch (error) {
        console.error('⚠️ Conversion failed, uploading original file:', error);
      }
    }
    
    // Step 4: Upload to S3
    const s3Key = `tickets/${ticketId}/${fileName}`;
    const s3 = getS3Client();
    
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
    }));
    
    console.log(`📤 Uploaded to S3: ${s3Key}`);
    
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || "http://localhost:4566";
    const s3Url = `${publicEndpoint}/${BUCKET_NAME}/${s3Key}`;
    
    return { s3Key, s3Url };
    
  } catch (error: any) {
    console.error('❌ Error downloading/uploading file:', error.message);
    throw error;
  }
}

/**
 * Helper: Converts Audio Buffer to MP3 Buffer
 */
async function convertToMp3(inputBuffer: Buffer, originalName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Create temp files
    const tempInput = path.join('/tmp', `input-${Date.now()}-${originalName}`);
    const tempOutput = path.join('/tmp', `output-${Date.now()}.mp3`);

    fs.writeFileSync(tempInput, inputBuffer);

    ffmpeg(tempInput)
      .toFormat('mp3')
      .audioBitrate('128k')
      .on('end', () => {
        try {
          const outputBuffer = fs.readFileSync(tempOutput);
          // Cleanup
          if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
          if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
          resolve(outputBuffer);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        // Cleanup on error
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        reject(err);
      })
      .save(tempOutput);
  });
}

/**
 * Gets default file extension based on media type
 */
function getDefaultExtension(mediaType: string): string {
  const extensions: Record<string, string> = {
    photo: '.jpg',
    video: '.mp4',
    audio: '.mp3',
    voice: '.oga',
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
    '.oga': 'audio/ogg',
    '.pdf': 'application/pdf',
  };
  
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}