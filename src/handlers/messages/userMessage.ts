import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { downloadAndUploadToS3 } from '../../services/s3Service';
import { loadConfig } from '../../config/loader';

export async function handleUserMessage(ctx: BotContext): Promise<void> {
  if (ctx.chat?.type !== 'private') return;
  if (ctx.message?.text?.startsWith('/')) return;
  if (!ctx.message || !ctx.from) return;
  
  const config = loadConfig();
  
  // Skip if user is a technician (commented out to test)
  // if (config.admin.technician_ids.includes(ctx.from.id)) {
  //   return;
  // }
  
  const userId = ctx.from.id;
  
  try {
    const activeTicket = await Ticket.findOne({
      userId,
      status: { $in: [
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
        TicketStatus.ESCALATED
      ] }
    }).sort({ createdAt: -1 });
    
    if (activeTicket) {
      await addMessageToTicket(ctx, activeTicket);
    } else {
      await createNewTicket(ctx);
    }
  } catch (error) {
    console.error('Error handling user message:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
}

async function createNewTicket(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  const user = ctx.from!;
  const message = ctx.message!;
  
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  
  const ticket = new Ticket({
    userId: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    initialMessage: messageText,
    status: TicketStatus.OPEN,
    hasUnreadMessages: true,
    lastMessageAt: new Date(),
    messages: []
  });
  
  await ticket.save(); // Save first to get ticketId
  
  let s3Key, s3Url;
  
  if (hasMedia && fileId) {
    try {
      const s3Result = await downloadAndUploadToS3(
        config.bot.token,
        fileId,
        ticket.ticketId,
        mediaType || 'unknown'
      );
      s3Key = s3Result.s3Key;
      s3Url = s3Result.s3Url;
    } catch (error) {
      console.error('S3 upload failed:', error);
    }
  }
  
  ticket.messages.push({
    from: 'user',
    text: messageText,
    timestamp: new Date(),
    userMessageId: message.message_id,
    hasMedia,
    mediaType,
    fileId,
    s3Key,
    s3Url,
    isRead: false
  });
  
  await ticket.save();
  
  await ctx.reply(
    `✅ *Ticket Created: ${ticket.ticketId}*\n\n` +
    `Your message has been sent to our support team.\n` +
    `We'll respond as soon as possible!`,
    { parse_mode: 'Markdown' }
  );
  
  console.log(`✅ Created ticket ${ticket.ticketId} for user ${user.id}`);
}

async function addMessageToTicket(ctx: BotContext, ticket: any): Promise<void> {
  const config = loadConfig();
  const message = ctx.message!;
  
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  
  let s3Key, s3Url;
  
  if (hasMedia && fileId) {
    try {
      const s3Result = await downloadAndUploadToS3(
        config.bot.token,
        fileId,
        ticket.ticketId,
        mediaType || 'unknown'
      );
      s3Key = s3Result.s3Key;
      s3Url = s3Result.s3Url;
    } catch (error) {
      console.error('S3 upload failed:', error);
    }
  }
  
  ticket.messages.push({
    from: 'user',
    text: messageText,
    timestamp: new Date(),
    userMessageId: message.message_id,
    hasMedia,
    mediaType,
    fileId,
    s3Key,
    s3Url,
    isRead: false
  });
  
  ticket.hasUnreadMessages = true;
  ticket.lastMessageAt = new Date();
  await ticket.save();
  
  console.log(`✅ Added message to ticket ${ticket.ticketId}`);
}

function extractMessageText(message: any): string {
  if ('text' in message && message.text) return message.text;
  if ('caption' in message && message.caption) return message.caption;
  return '[Media message]';
}

function extractMediaInfo(message: any): {
  hasMedia: boolean;
  mediaType?: 'photo' | 'document' | 'voice' | 'video' | 'audio';
  fileId?: string;
} {
  if ('photo' in message && message.photo) {
    return {
      hasMedia: true,
      mediaType: 'photo' as const,
      fileId: message.photo[message.photo.length - 1].file_id
    };
  }
  
  if ('document' in message && message.document) {
    return {
      hasMedia: true,
      mediaType: 'document' as const,
      fileId: message.document.file_id
    };
  }
  
  if ('voice' in message && message.voice) {
    return {
      hasMedia: true,
      mediaType: 'voice' as const,
      fileId: message.voice.file_id
    };
  }
  
  if ('video' in message && message.video) {
    return {
      hasMedia: true,
      mediaType: 'video' as const,
      fileId: message.video.file_id
    };
  }
  
  if ('audio' in message && message.audio) {
    return {
      hasMedia: true,
      mediaType: 'audio' as const,
      fileId: message.audio.file_id
    };
  }
  
  return { hasMedia: false };
}