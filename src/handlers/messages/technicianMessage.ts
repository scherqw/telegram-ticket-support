import { BotContext } from '../../types';
import { Ticket, TicketStatus, ITicket } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';
import { downloadAndUploadToS3 } from '../../services/s3Service';

/**
 * Handles all messages from technicians in the tech group
 */
export async function handleTechnicianMessage(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  
  if (ctx.chat?.id !== config.groups.technician_group_id) return;
  if (ctx.message?.text?.startsWith('/')) return;
  if (!ctx.message || !ctx.from) return;
  if (ctx.from.is_bot) return;
  
  const threadId = ctx.message.message_thread_id;
  if (!threadId) return;
  if (threadId === config.topics.general_topic_id) return;
  
  try {
    const ticket = await Ticket.findOne({
      topicId: threadId,
      status: { $ne: TicketStatus.CLOSED }
    });
    
    if (!ticket) {
      await ctx.reply(
        '⚠️ No active ticket found for this topic.\n' +
        'It may have been closed or deleted.',
        { 
          message_thread_id: threadId,
          reply_to_message_id: ctx.message.message_id
        }
      );
      return;
    }
    
    await forwardTechMessageToUser(ctx, ticket);
    
  } catch (error) {
    console.error('Error handling technician message:', error);
    await ctx.reply(
      '❌ Failed to send message to user. Please try again.',
      { 
        message_thread_id: threadId,
        reply_to_message_id: ctx.message.message_id
      }
    );
  }
}

/**
 * Forwards technician message to user
 */
async function forwardTechMessageToUser(
  ctx: BotContext,
  ticket: ITicket
): Promise<void> {
  const config = loadConfig();
  const message = ctx.message!;
  const tech = ctx.from!;
  const techName = tech.first_name || 'Support';
  
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  
  try {
    let sentMessage;
    let s3Key: string | undefined;
    let s3Url: string | undefined;
    
    // Handle media upload to S3
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
        
        // Copy media to user
        sentMessage = await ctx.api.copyMessage(
          ticket.userId,
          ctx.chat!.id,
          message.message_id,
          {
            caption: messageText ? `💬 *${techName}:*\n\n${messageText}` : `💬 *${techName} sent a ${mediaType}*`,
            parse_mode: 'Markdown'
          }
        );
      } catch (error) {
        console.error('Failed to upload media to S3:', error);
        // Continue without S3 - still forward the message
        sentMessage = await ctx.api.copyMessage(
          ticket.userId,
          ctx.chat!.id,
          message.message_id,
          {
            caption: messageText ? `💬 *${techName}:*\n\n${messageText}` : `💬 *${techName} sent a ${mediaType}*`,
            parse_mode: 'Markdown'
          }
        );
      }
    } else {
      // Send text message
      sentMessage = await ctx.api.sendMessage(
        ticket.userId,
        `💬 *${techName}:*\n\n${messageText}`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Update ticket status
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }
    
    // Assign to technician if not assigned
    if (!ticket.assignedTo) {
      ticket.assignedTo = tech.id;
      ticket.assignedToName = techName;
    }
    
    // Save to transcript
    ticket.messages.push({
      from: 'technician',
      text: messageText,
      timestamp: new Date(),
      userMessageId: sentMessage.message_id,
      topicMessageId: message.message_id,
      technicianId: tech.id,
      technicianName: techName,
      hasMedia,
      mediaType,
      fileId,
      s3Key,
      s3Url
    });
    
    await ticket.save();
    
    console.log(
      `✅ Forwarded message from ${techName} to user ${ticket.userId} (${ticket.ticketId})` +
      `${s3Url ? ' (media stored in S3)' : ''}`
    );
    
  } catch (error: any) {
    console.error('Error forwarding to user:', error);
    
    if (error.description?.includes('bot was blocked')) {
      await ctx.reply(
        '⚠️ Cannot send message: User has blocked the bot.',
        { 
          message_thread_id: ticket.topicId,
          reply_to_message_id: message.message_id
        }
      );
      return;
    }
    
    throw error;
  }
}

function extractMessageText(message: any): string {
  if ('text' in message && message.text) return message.text;
  if ('caption' in message && message.caption) return message.caption;
  return '[Media message]';
}

function extractMediaInfo(message: any): {
  hasMedia: boolean;
  mediaType?: 'photo' | 'document' | 'voice' | 'video' | 'audio' | 'sticker';
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
  
  if ('sticker' in message && message.sticker) {
    return {
      hasMedia: true,
      mediaType: 'sticker' as const,
      fileId: message.sticker.file_id
    };
  }
  
  return { hasMedia: false };
}