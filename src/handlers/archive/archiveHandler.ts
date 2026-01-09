import { BotContext } from '../../types';
import { ITicket, ITicketMessage } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';
import { escapeMarkdown } from '../../utils/formatters';
import axios from 'axios';
import { InputFile } from 'grammy';
import { BUCKET_NAME } from '../../services/s3Service'; // Import BUCKET_NAME

/**
 * Archives a closed ticket to the archive group
 */
export async function archiveTicket(
  ticket: ITicket,
  botApi: any
): Promise<void> {
  const config = loadConfig();

  if (!config.features.enable_archiving) {
    return;
  }

  if (!config.groups.archive_group_id) {
    console.error('❌ Archive group ID not configured');
    return;
  }

  try {
    const safeUser = escapeMarkdown(ticket.firstName);
    const archiveTopicName = `📦 [CLOSED] ${ticket.ticketId} - ${safeUser}`;
    
    const archiveTopic = await botApi.createForumTopic(
      config.groups.archive_group_id,
      archiveTopicName,
      {
        icon_color: 0x808080
      }
    );

    ticket.archiveTopicId = archiveTopic.message_thread_id;
    ticket.archiveTopicName = archiveTopicName;
    ticket.archivedAt = new Date();

    // Send ticket summary
    const summary = buildTicketSummary(ticket);
    
    await botApi.sendMessage(
      config.groups.archive_group_id,
      summary,
      {
        message_thread_id: archiveTopic.message_thread_id,
        parse_mode: 'Markdown'
      }
    );

    // Send conversation transcript with media
    if (ticket.messages && ticket.messages.length > 0) {
      await sendTranscriptWithMedia(
        botApi, 
        ticket, 
        archiveTopic.message_thread_id, 
        config.groups.archive_group_id
      );
    }

    // Add archive footer
    await botApi.sendMessage(
      config.groups.archive_group_id,
      '─────────────────\n' +
      '📦 *Archived Ticket*\n' +
      `This is a permanent archive of ticket ${ticket.ticketId}.\n` +
      `Archived: ${new Date().toLocaleString()}`,
      {
        message_thread_id: archiveTopic.message_thread_id,
        parse_mode: 'Markdown'
      }
    );

    await ticket.save();

    console.log(`📦 Ticket ${ticket.ticketId} archived to topic ${archiveTopic.message_thread_id}`);

  } catch (error: any) {
    console.error(`❌ Failed to archive ticket ${ticket.ticketId}:`, error.message);
  }
}

/**
 * Sends transcript with media - now supports S3 URLs
 */
async function sendTranscriptWithMedia(
  api: any, 
  ticket: ITicket, 
  threadId: number, 
  chatId: number
): Promise<void> {
  await api.sendMessage(chatId, '💬 *CONVERSATION TRANSCRIPT*', { 
    message_thread_id: threadId, 
    parse_mode: 'Markdown' 
  });

  let textBuffer = '';

  for (const [index, msg] of ticket.messages.entries()) {
    const timestamp = formatDate(msg.timestamp);
    const senderIcon = msg.from === 'user' ? '👤' : '👨‍💼';
    const senderName = msg.from === 'user' 
      ? ticket.firstName 
      : (msg.technicianName || 'Support');
      
    const header = `*[${index + 1}] ${senderIcon} ${escapeMarkdown(senderName)} - ${timestamp}*\n`;

    if (msg.hasMedia) {
      // Flush pending text first
      if (textBuffer) {
        await sendBufferedText(api, chatId, threadId, textBuffer);
        textBuffer = '';
      }

      // Try S3 first, fallback to Telegram fileId
      if (msg.s3Url) {
        await sendMediaFromS3(api, chatId, threadId, msg, header);
      } else if (msg.fileId) {
        await sendMediaFromTelegram(api, chatId, threadId, msg, header);
      } else {
        textBuffer += `${header}⚠️ [Media not available - no S3 URL or fileId]\n${msg.text}\n\n`;
      }
      
      await sleep(200);

    } else {
      // Text message - add to buffer
      const safeBody = escapeMarkdown(msg.text);
      textBuffer += `${header}${safeBody}\n\n`;

      if (textBuffer.length > 3500) {
        await sendBufferedText(api, chatId, threadId, textBuffer);
        textBuffer = '';
        await sleep(200);
      }
    }
  }

  // Final flush
  if (textBuffer) {
    await sendBufferedText(api, chatId, threadId, textBuffer);
  }
}

/**
 * NEW: Sends media from S3 URL by downloading and re-uploading
 */
async function sendMediaFromS3(
  api: any, 
  chatId: number, 
  threadId: number, 
  msg: ITicketMessage, 
  caption: string
): Promise<void> {
  try {
    // Construct INTERNAL URL for the bot to download
    // We use the S3_ENDPOINT (localstack:4566) instead of the public one (localhost:4566)
    const s3Endpoint = process.env.S3_ENDPOINT || "http://localstack:4566";
    // Ensure we use the s3Key to build the path correctly
    const downloadUrl = msg.s3Key 
      ? `${s3Endpoint}/${BUCKET_NAME}/${msg.s3Key}` 
      : msg.s3Url!; // Fallback (though rare)

    console.log(`📥 Retrieving media from S3 (Internal): ${downloadUrl}`);
    
    // Download from S3
    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    
    // Wrap buffer in InputFile (Critical for Grammy)
    const inputFile = new InputFile(Buffer.from(response.data));
    
    const options = {
      message_thread_id: threadId,
      caption: caption,
      parse_mode: 'Markdown'
    };

    // Send based on media type
    switch (msg.mediaType) {
      case 'photo':
        await api.sendPhoto(chatId, inputFile, options);
        break;
      case 'document':
        await api.sendDocument(chatId, inputFile, options);
        break;
      case 'voice':
        await api.sendVoice(chatId, inputFile, options);
        break;
      case 'video':
        await api.sendVideo(chatId, inputFile, options);
        break;
      case 'audio':
        await api.sendAudio(chatId, inputFile, options);
        break;
      case 'sticker':
        await api.sendMessage(chatId, caption, { message_thread_id: threadId, parse_mode: 'Markdown' });
        await api.sendSticker(chatId, inputFile, { message_thread_id: threadId });
        break;
      default:
        await api.sendMessage(chatId, `${caption}\n📎 [S3 Media: ${msg.s3Key}]`, options);
    }
    
    console.log(`✅ Successfully sent media from S3`);
    
  } catch (error) {
    console.error(`Failed to send media from S3:`, error);
    // Fallback to fileId if S3 fails
    if (msg.fileId) {
      await sendMediaFromTelegram(api, chatId, threadId, msg, caption);
    } else {
      await api.sendMessage(chatId, `${caption}\n⚠️ [Media unavailable]`, { 
        message_thread_id: threadId, 
        parse_mode: 'Markdown' 
      });
    }
  }
}

/**
 * Sends media using Telegram fileId (original method)
 */
async function sendMediaFromTelegram(
  api: any, 
  chatId: number, 
  threadId: number, 
  msg: ITicketMessage, 
  caption: string
): Promise<void> {
  try {
    const options = {
      message_thread_id: threadId,
      caption: caption,
      parse_mode: 'Markdown'
    };

    switch (msg.mediaType) {
      case 'photo':
        await api.sendPhoto(chatId, msg.fileId, options);
        break;
      case 'document':
        await api.sendDocument(chatId, msg.fileId, options);
        break;
      case 'voice':
        await api.sendVoice(chatId, msg.fileId, options);
        break;
      case 'video':
        await api.sendVideo(chatId, msg.fileId, options);
        break;
      case 'audio':
        await api.sendAudio(chatId, msg.fileId, options);
        break;
      case 'sticker':
        await api.sendMessage(chatId, caption, { message_thread_id: threadId, parse_mode: 'Markdown' });
        await api.sendSticker(chatId, msg.fileId, { message_thread_id: threadId });
        break;
      default:
        await api.sendMessage(chatId, `${caption}\n[Unknown media type]`, options);
    }
  } catch (error) {
    console.error(`Failed to send media from Telegram:`, error);
    await api.sendMessage(chatId, `${caption}\n⚠️ [Error loading media]`, { 
      message_thread_id: threadId, 
      parse_mode: 'Markdown' 
    });
  }
}

async function sendBufferedText(api: any, chatId: number, threadId: number, text: string) {
  try {
    await api.sendMessage(chatId, text, {
      message_thread_id: threadId,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.warn('Markdown failed, sending plain text');
    await api.sendMessage(chatId, text, {
      message_thread_id: threadId
    });
  }
}

function buildTicketSummary(ticket: ITicket): string {
  const userName = ticket.firstName + 
    (ticket.lastName ? ' ' + ticket.lastName : '') +
    (ticket.username ? ` (@${ticket.username})` : '');

  const categories = ticket.categories && ticket.categories.length > 0
    ? ticket.categories.join(', ')
    : 'None';

  const rating = (ticket.rating && typeof ticket.rating.stars === 'number')
    ? `${'⭐'.repeat(ticket.rating.stars)} (${ticket.rating.stars}/5)`
    : 'Pending / Not rated';

  const assignedTo = ticket.assignedToName || 'Unassigned';

  return (
    `📦 *ARCHIVED TICKET SUMMARY*\n\n` +
    `🎫 *Ticket ID:* ${ticket.ticketId}\n` +
    `👤 *User:* ${escapeMarkdown(userName)}\n` +
    `🆔 *User ID:* \`${ticket.userId}\`\n` +
    `👨‍💼 *Assigned To:* ${escapeMarkdown(assignedTo)}\n` +
    `📂 *Categories:* ${escapeMarkdown(categories)}\n` +
    `⭐ *Rating:* ${rating}\n` +
    `💬 *Messages:* ${ticket.messages.length}\n` +
    `📅 *Created:* ${formatDate(ticket.createdAt)}\n` +
    `📅 *Closed:* ${ticket.closedAt ? formatDate(ticket.closedAt) : 'Unknown'}\n\n` +
    `*Initial Request:*\n${escapeMarkdown(ticket.initialMessage)}\n\n` +
    `─────────────────`
  );
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}