import { BotContext } from '../../types';
import { Ticket, TicketStatus, ITicket } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';

/**
 * Handles all messages from technicians in the tech group
 * 
 * Logic:
 * 1. Only process messages in tech group
 * 2. Only process messages in forum topics (not general chat)
 * 3. Ignore general/permanent topic
 * 4. Find ticket by topicId
 * 5. Forward to user
 */
export async function handleTechnicianMessage(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  
  // Only process messages in tech group
  if (ctx.chat?.id !== config.groups.technician_group_id) return;
  
  // Ignore commands (they have their own handlers)
  if (ctx.message?.text?.startsWith('/')) return;
  
  // Must have a message
  if (!ctx.message || !ctx.from) return;

  if (ctx.from.is_bot) return;
  
  // Only process messages in topics (message_thread_id exists)
  const threadId = ctx.message.message_thread_id;
  if (!threadId) return;
  
  // Ignore general/permanent topic
  if (threadId === config.topics.general_topic_id) return;
  
  try {
    // ===== STEP 1: Find ticket by topic ID =====
    const ticket = await Ticket.findOne({
      topicId: threadId,
      status: { $ne: TicketStatus.CLOSED }
    });
    
    if (!ticket) {
      // Topic exists but no active ticket
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
    
    // ===== STEP 2: Forward to user =====
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
  const message = ctx.message!;
  const tech = ctx.from!;
  const techName = tech.first_name || 'Support';
  
  // Extract message content
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  
  try {
    // ===== Forward to user =====
    let sentMessage;
    
    if (hasMedia) {
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
    } else {
      // Send text message
      sentMessage = await ctx.api.sendMessage(
        ticket.userId,
        `💬 *${techName}:*\n\n${messageText}`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // ===== Update ticket status =====
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }
    
    // Assign to technician if not assigned
    if (!ticket.assignedTo) {
      ticket.assignedTo = tech.id;
      ticket.assignedToName = techName;
    }
    
    // ===== Save to transcript =====
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
      fileId
    });
    
    await ticket.save();
    
    // ===== React to confirm =====
    try {
      await ctx.react('👍');
    } catch (error) {
      // Reaction might fail, not critical
      console.log('Could not react to message');
    }
    
    console.log(`✅ Forwarded message from ${techName} to user ${ticket.userId} (${ticket.ticketId})`);
    
  } catch (error: any) {
    console.error('Error forwarding to user:', error);
    
    // Check if user blocked the bot
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

/**
 * Helper: Extract text from message
 */
function extractMessageText(message: any): string {
  if ('text' in message && message.text) {
    return message.text;
  }
  
  if ('caption' in message && message.caption) {
    return message.caption;
  }
  
  return '[Media message]';
}

/**
 * Helper: Extract media information
 */
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