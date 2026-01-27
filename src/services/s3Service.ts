import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Configure ffmpeg
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export const BUCKET_NAME = 'telegram-media';

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT || "http://localstack:4566",
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    },
    forcePathStyle: true,
  });
}

export async function ensureBucketExists(): Promise<void> {
  const s3 = getS3Client();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log(`📦 Creating S3 bucket "${BUCKET_NAME}"...`);
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    } else {
      throw error;
    }
  }

  // Apply CORS
  await s3.send(new PutBucketCorsCommand({
    Bucket: BUCKET_NAME,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedOrigins: ["*"],
          ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
          MaxAgeSeconds: 3000
        }
      ]
    }
  }));
}

/**
 * Direct Upload to S3 (Used by Technician Web App)
 */
export async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  ticketId: string,
  mimeType: string
): Promise<{ s3Key: string; s3Url: string }> {
  try {
    // If it's audio/voice, ensure it is MP3 for Web App compatibility
    if (mimeType.startsWith('audio') || mimeType === 'application/ogg') {
      if (!fileName.endsWith('.mp3')) {
        fileBuffer = await convertToMp3(fileBuffer, fileName);
        fileName = fileName.replace(/\.[^/.]+$/, "") + ".mp3";
        mimeType = 'audio/mpeg';
      }
    }

    const s3Key = `tickets/${ticketId}/${Date.now()}_${fileName}`;
    const s3 = getS3Client();

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimeType,
    }));

    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || "http://localhost:4566";
    const s3Url = `${publicEndpoint}/${BUCKET_NAME}/${s3Key}`;

    return { s3Key, s3Url };
  } catch (error) {
    console.error('❌ Direct S3 Upload failed:', error);
    throw error;
  }
}

/**
 * Download from Telegram and Upload to S3 (Used by Bot User)
 */
export async function downloadAndUploadToS3(
  botToken: string,
  fileId: string,
  ticketId: string,
  mediaType: string
): Promise<{ s3Key: string; s3Url: string }> {
  try {
    // 1. Get File Info
    const fileInfoResponse = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    
    const filePath = fileInfoResponse.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    
    // 2. Download
    const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const fileBuffer = Buffer.from(fileResponse.data);
    
    const ext = path.extname(filePath) || getDefaultExtension(mediaType);
    const fileName = `${mediaType}${ext}`;
    const contentType = getContentType(mediaType, ext);

    // 3. Reuse the direct upload logic
    return await uploadFileToS3(fileBuffer, fileName, ticketId, contentType);
    
  } catch (error: any) {
    console.error('❌ Telegram-to-S3 failed:', error.message);
    throw error;
  }
}

async function convertToMp3(inputBuffer: Buffer, originalName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tempInput = path.join('/tmp', `input-${Date.now()}-${originalName}`);
    const tempOutput = path.join('/tmp', `output-${Date.now()}.mp3`);

    fs.writeFileSync(tempInput, inputBuffer);

    ffmpeg(tempInput)
      .toFormat('mp3')
      .audioBitrate('128k')
      .on('end', () => {
        const outputBuffer = fs.readFileSync(tempOutput);
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
        resolve(outputBuffer);
      })
      .on('error', (err) => {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        reject(err);
      })
      .save(tempOutput);
  });
}

function getDefaultExtension(mediaType: string): string {
  const extensions: Record<string, string> = {
    photo: '.jpg',
    video: '.mp4',
    audio: '.mp3',
    voice: '.oga',
    document: '.bin'
  };
  return extensions[mediaType] || '.bin';
}

function getContentType(mediaType: string, extension: string): string {
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.oga': 'audio/ogg',
    '.pdf': 'application/pdf',
  };
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}