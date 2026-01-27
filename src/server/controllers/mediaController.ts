// import { ITicket, TicketStatus } from '../../database/models/Ticket';
// import { Bot } from 'grammy';
// import { InputFile } from 'grammy';
// import ffmpeg from 'fluent-ffmpeg';
// import ffmpegStatic from 'ffmpeg-static';
// import path from 'path';
// import fs from 'fs';
// import { downloadAndUploadToS3 } from '../../services/s3Service';
// import { loadConfig } from '../../config/loader';

// if (ffmpegStatic) {
//   ffmpeg.setFfmpegPath(ffmpegStatic);
// }

// let botInstance: Bot | null = null;

// export function setBotInstance(bot: Bot): void {
//   botInstance = bot;
// }

// export async function handleMediaUpload(
//   ticket: ITicket,
//   file: Express.Multer.File,
//   caption: string,
//   technician: { id: number; first_name: string }
// ): Promise<void> {
//   if (!botInstance) {
//     throw new Error('Bot instance not initialized');
//   }

//   const config = loadConfig();
//   const techName = technician.first_name;
//   const messageCaption = caption 
//     ? `💬 *${techName}:*\n\n${caption}` 
//     : `💬 *${techName} sent a file*`;

//   let sentMessage;
//   let mediaType: string;
//   let s3Key: string | undefined;
//   let s3Url: string | undefined;

//   // Detect and send media based on type
//   if (file.mimetype.startsWith('image/')) {
//     mediaType = 'photo';
//     const inputFile = new InputFile(file.buffer, file.originalname);
//     sentMessage = await botInstance.api.sendPhoto(ticket.userId, inputFile, {
//       caption: messageCaption,
//       parse_mode: 'Markdown'
//     });
//   } else if (file.mimetype.startsWith('video/')) {
//     mediaType = 'video';
//     const inputFile = new InputFile(file.buffer, file.originalname);
//     sentMessage = await botInstance.api.sendVideo(ticket.userId, inputFile, {
//       caption: messageCaption,
//       parse_mode: 'Markdown'
//     });
//   } else if (file.mimetype.startsWith('audio/') || file.originalname.endsWith('.webm')) {
//     mediaType = 'voice';
//     const oggBuffer = await convertToOggOpus(file.buffer);
//     const inputFile = new InputFile(oggBuffer, 'voice.ogg');
//     sentMessage = await botInstance.api.sendVoice(ticket.userId, inputFile, {
//       caption: caption || undefined,
//       parse_mode: 'Markdown'
//     });
//   } else {
//     mediaType = 'document';
//     const inputFile = new InputFile(file.buffer, file.originalname);
//     sentMessage = await botInstance.api.sendDocument(ticket.userId, inputFile, {
//       caption: messageCaption,
//       parse_mode: 'Markdown'
//     });
//   }

//   // Get file_id from sent message
//   let fileId: string | undefined;
//   if ('photo' in sentMessage && sentMessage.photo) {
//     fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
//   } else if ('video' in sentMessage && sentMessage.video) {
//     fileId = sentMessage.video.file_id;
//   } else if ('voice' in sentMessage && sentMessage.voice) {
//     fileId = sentMessage.voice.file_id;
//   } else if ('document' in sentMessage && sentMessage.document) {
//     fileId = sentMessage.document.file_id;
//   }

//   // Upload to S3
//   if (fileId) {
//     try {
//       const s3Result = await downloadAndUploadToS3(
//         config.bot.token,
//         fileId,
//         ticket.ticketId,
//         mediaType
//       );
//       s3Key = s3Result.s3Key;
//       s3Url = s3Result.s3Url;
//     } catch (error) {
//       console.error('S3 upload failed:', error);
//     }
//   }

//   // Update ticket
//   if (ticket.status === TicketStatus.OPEN) {
//     ticket.status = TicketStatus.IN_PROGRESS;
//   }

//   if (!ticket.assignedTo) {
//     ticket.assignedTo = technician.id;
//     ticket.assignedToName = techName;
//   }

//   ticket.messages.push({
//     from: 'technician',
//     text: caption || '[Media]',
//     timestamp: new Date(),
//     userMessageId: sentMessage.message_id,
//     technicianId: technician.id,
//     technicianName: techName,
//     hasMedia: true,
//     mediaType: mediaType as any,
//     fileId,
//     s3Key,
//     s3Url,
//     isRead: true
//   });

//   ticket.lastMessageAt = new Date();
//   await ticket.save();
// }

// async function convertToOggOpus(inputBuffer: Buffer): Promise<Buffer> {
//   return new Promise((resolve, reject) => {
//     const tempInput = path.join('/tmp', `input-${Date.now()}.webm`);
//     const tempOutput = path.join('/tmp', `output-${Date.now()}.ogg`);

//     fs.writeFileSync(tempInput, inputBuffer);

//     ffmpeg(tempInput)
//       .audioCodec('libopus')
//       .audioBitrate('64k')
//       .audioChannels(1)
//       .audioFrequency(48000)
//       .format('ogg')
//       .on('end', () => {
//         const outputBuffer = fs.readFileSync(tempOutput);
        
//         fs.unlinkSync(tempInput);
//         fs.unlinkSync(tempOutput);
        
//         resolve(outputBuffer);
//       })
//       .on('error', (err) => {
//         if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
//         if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
//         reject(err);
//       })
//       .save(tempOutput);
//   });
// }

import { ITicket, TicketStatus } from '../../database/models/Ticket';
import { Bot } from 'grammy';
import { InputFile } from 'grammy';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { uploadFileToS3 } from '../../services/s3Service';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

let botInstance: Bot | null = null;

export function setBotInstance(bot: Bot): void {
  botInstance = bot;
}

export async function handleMediaUpload(
  ticket: ITicket,
  file: Express.Multer.File,
  caption: string,
  technician: { id: number; first_name: string }
): Promise<void> {
  if (!botInstance) {
    throw new Error('Bot instance not initialized');
  }

  const techName = technician.first_name;
  const messageCaption = caption 
    ? `💬 *${techName}:*\n\n${caption}` 
    : `💬 *${techName} sent a file*`;

  let sentMessage;
  let mediaType: string = 'document'; // Default
  
  // PARALLEL EXECUTION:
  // 1. Upload to S3 (for Web App history)
  // 2. Send to Telegram (for User)
  
  const s3UploadPromise = uploadFileToS3(
    file.buffer, 
    file.originalname, 
    ticket.ticketId, 
    file.mimetype
  );

  let telegramSendPromise;

  // Telegram Logic
  if (file.mimetype.startsWith('image/')) {
    mediaType = 'photo';
    telegramSendPromise = botInstance.api.sendPhoto(ticket.userId, new InputFile(file.buffer, file.originalname), {
      caption: messageCaption, parse_mode: 'Markdown'
    });
  } else if (file.mimetype.startsWith('video/')) {
    mediaType = 'video';
    telegramSendPromise = botInstance.api.sendVideo(ticket.userId, new InputFile(file.buffer, file.originalname), {
      caption: messageCaption, parse_mode: 'Markdown'
    });
  } else if (file.mimetype.startsWith('audio/') || file.originalname.endsWith('.webm')) {
    mediaType = 'voice';
    // For Telegram, we MUST convert to OGG Opus if it's a voice note
    const oggBuffer = await convertToOggOpus(file.buffer);
    telegramSendPromise = botInstance.api.sendVoice(ticket.userId, new InputFile(oggBuffer, 'voice.ogg'), {
      caption: caption || undefined, parse_mode: 'Markdown'
    });
  } else {
    telegramSendPromise = botInstance.api.sendDocument(ticket.userId, new InputFile(file.buffer, file.originalname), {
      caption: messageCaption, parse_mode: 'Markdown'
    });
  }

  // Await both operations
  const [s3Result, telegramResult] = await Promise.all([
    s3UploadPromise,
    telegramSendPromise
  ]);

  sentMessage = telegramResult;
  const { s3Key, s3Url } = s3Result;

  // Extract Telegram File ID
  let fileId: string | undefined;
  if ('photo' in sentMessage && sentMessage.photo) {
    fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
  } else if ('video' in sentMessage && sentMessage.video) {
    fileId = sentMessage.video.file_id;
  } else if ('voice' in sentMessage && sentMessage.voice) {
    fileId = sentMessage.voice.file_id;
  } else if ('document' in sentMessage && sentMessage.document) {
    fileId = sentMessage.document.file_id;
  }

  // Update Ticket Status
  if (ticket.status === TicketStatus.OPEN) {
    ticket.status = TicketStatus.IN_PROGRESS;
  }

  if (!ticket.assignedTo) {
    ticket.assignedTo = technician.id;
    ticket.assignedToName = techName;
  }

  ticket.messages.push({
    from: 'technician',
    text: caption || '[Media]',
    timestamp: new Date(),
    userMessageId: sentMessage.message_id,
    technicianId: technician.id,
    technicianName: techName,
    hasMedia: true,
    mediaType: mediaType as any,
    fileId,
    s3Key,
    s3Url,
    isRead: true
  });

  ticket.lastMessageAt = new Date();
  await ticket.save();
}

async function convertToOggOpus(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tempInput = path.join('/tmp', `input-${Date.now()}.webm`);
    const tempOutput = path.join('/tmp', `output-${Date.now()}.ogg`);

    fs.writeFileSync(tempInput, inputBuffer);

    ffmpeg(tempInput)
      .audioCodec('libopus')
      .audioBitrate('64k')
      .audioChannels(1)
      .audioFrequency(48000)
      .format('ogg')
      .on('end', () => {
        const outputBuffer = fs.readFileSync(tempOutput);
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
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