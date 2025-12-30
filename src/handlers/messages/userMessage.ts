import { BotContext } from '../../types';
import { Ticket, TicketStatus, ITicket } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';

/**
 * Handles all messages from users in private chat
 * * Logic:
 * 1. If user has active ticket → Forward to existing topic
 * 2. If no active ticket → Create new ticket with new topic
 */
export async function handleUserMessage(ctx: BotContext): Promise<void> {
  // Only process private DMs
  if (ctx.chat?.type !== 'private') return;
  
  // Ignore commands (they have their own handlers)
  if (ctx.message?.text?.startsWith('/')) return;
  
  // Must have a message
  if (!ctx.message || !ctx.from) return;
  
  const userId = ctx.from.id;
  
  try {
    // ===== STEP 1: Check if user has active ticket =====
    // Sort by createdAt desc to get the NEWEST active ticket.
    const activeTicket = await Ticket.findOne({
      userId,
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] }
    }).sort({ createdAt: -1 });
    
    if (activeTicket) {
      // ===== State: Existing Ticket =====
      await forwardUserMessageToTopic(ctx, activeTicket);
    } else {
      // ===== State: New Ticket =====
      await createNewTicketWithTopic(ctx);
    }
  } catch (error) {
    console.error('Error handling user message:', error);
    await ctx.reply(
      '❌ An error occurred. Please try again or contact support.',
      { reply_to_message_id: ctx.message.message_id }
    );
  }
}

/**
 * Creates a new ticket and forum topic
 */
async function createNewTicketWithTopic(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  const user = ctx.from!;
  const message = ctx.message!;
  
  // Extract message content
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  
  // ===== STEP 1: Create ticket in database =====
  const ticket = new Ticket({
    userId: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    initialMessage: messageText,
    status: TicketStatus.OPEN,
    techGroupChatId: config.groups.technician_group_id,
    messages: []
  });
  
  await ticket.save();
  
  // ===== STEP 2: Create forum topic =====
  const topicName = `${ticket.ticketId} - ${user.first_name}`;
  
  try {
    const forumTopic = await ctx.api.createForumTopic(
      config.groups.technician_group_id,
      topicName,
      {
        icon_color: 0x6FB9F0  // Blue color
      }
    );
    
    // ===== STEP 3: Update ticket with topic info =====
    ticket.topicId = forumTopic.message_thread_id;
    ticket.topicName = topicName;
    
    // ===== STEP 4: Send initial message to topic =====
    const initialTopicMessage = formatInitialTopicMessage(ticket, user, messageText);
    
    const sentMessage = await ctx.api.sendMessage(
      config.groups.technician_group_id,
      initialTopicMessage,
      {
        message_thread_id: ticket.topicId,
        parse_mode: 'Markdown'
      }
    );
    
    // ===== STEP 5: Forward media if present =====
    if (hasMedia) {
      await ctx.api.copyMessage(
        config.groups.technician_group_id,
        ctx.chat!.id,
        message.message_id,
        {
          message_thread_id: ticket.topicId
        }
      );
    }
    
    // ===== STEP 6: Save to transcript =====
    ticket.messages.push({
      from: 'user',
      text: messageText,
      timestamp: new Date(),
      userMessageId: message.message_id,
      topicMessageId: sentMessage.message_id,
      hasMedia,
      mediaType,
      fileId
    });
    
    await ticket.save();
    
    // ===== STEP 7: Confirm to user =====
    await ctx.reply(
      `✅ *Ticket Created: ${ticket.ticketId}*\n\n` +
      `Your message has been sent to our support team.\n` +
      `Continue chatting here - all messages will be forwarded automatically.`,
      { 
        parse_mode: 'Markdown',
        reply_to_message_id: message.message_id
      }
    );
    
    console.log(`✅ Created ticket ${ticket.ticketId} for user ${user.id}`);
    
  } catch (error) {
    console.error('Error creating forum topic:', error);
    
    // Clean up ticket if topic creation failed
    await Ticket.deleteOne({ _id: ticket._id });
    
    throw error;
  }
}

/**
 * Forwards user message to existing ticket topic
 */
async function forwardUserMessageToTopic(
  ctx: BotContext,
  ticket: ITicket
): Promise<void> {
  const config = loadConfig();
  const message = ctx.message!;
  
  // Check if topic still exists
  if (!ticket.topicId) {
    console.log(`⚠️ Closing broken ticket ${ticket.ticketId} (Missing topicId)`);
    
    // FIX: Use updateOne to bypass schema validation for legacy documents
    await Ticket.updateOne(
      { _id: ticket._id },
      { 
        $set: { 
          status: TicketStatus.CLOSED,
          closedAt: new Date()
        } 
      }
    );

    await ctx.reply(
      '⚠️ Your previous ticket topic was missing. Creating a new ticket...',
      { reply_to_message_id: message.message_id }
    );
    return createNewTicketWithTopic(ctx);
  }
  
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  
  try {
    // ===== Forward to topic =====
    let sentMessage;
    
    if (hasMedia) {
      sentMessage = await ctx.api.copyMessage(
        ticket.techGroupChatId,
        ctx.chat!.id,
        message.message_id,
        {
          message_thread_id: ticket.topicId,
          caption: messageText ? `📨 *From User:*\n\n${messageText}` : undefined,
          parse_mode: 'Markdown'
        }
      );
    } else {
      sentMessage = await ctx.api.sendMessage(
        ticket.techGroupChatId,
        `📨 *From User:*\n\n${messageText}`,
        {
          message_thread_id: ticket.topicId,
          parse_mode: 'Markdown'
        }
      );
    }
    
    // ===== Save to transcript =====
    ticket.messages.push({
      from: 'user',
      text: messageText,
      timestamp: new Date(),
      userMessageId: message.message_id,
      topicMessageId: sentMessage.message_id,
      hasMedia,
      mediaType,
      fileId
    });
    
    // Update status if needed
    if (ticket.status === TicketStatus.IN_PROGRESS) {
      ticket.status = TicketStatus.OPEN; // User replied, needs attention
    }
    
    await ticket.save();
    
  } catch (error: any) {
    console.error('Error forwarding to topic:', error);
    
    // Check if topic was deleted
    if (error.description?.includes('thread not found') || error.description?.includes('Bad Request: message thread not found')) {
      console.log(`⚠️ Closing broken ticket ${ticket.ticketId} (Thread not found in Telegram)`);
      
      // FIX: Use updateOne to bypass schema validation for legacy documents
      await Ticket.updateOne(
        { _id: ticket._id },
        { 
          $set: { 
            status: TicketStatus.CLOSED,
            closedAt: new Date()
          } 
        }
      );

      await ctx.reply(
        '⚠️ Your ticket topic was deleted by an admin. Creating a new ticket...',
        { reply_to_message_id: message.message_id }
      );
      return createNewTicketWithTopic(ctx);
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

/**
 * Helper: Format initial topic message
 */
function formatInitialTopicMessage(
  ticket: ITicket,
  user: any,
  messageText: string
): string {
  return (
    `🎫 *New Ticket*\n\n` +
    `👤 *User:* ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` +
    `${user.username ? ` (@${user.username})` : ''}\n` +
    `🆔 *User ID:* \`${user.id}\`\n` +
    `📋 *Ticket ID:* ${ticket.ticketId}\n` +
    `⏰ *Created:* ${new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n\n` +
    `*Initial Message:*\n${messageText}\n\n` +
    `─────────────────\n` +
    `💬 Reply here to respond to the user\n` +
    `🔒 Use /close to close this ticket`
  );
}