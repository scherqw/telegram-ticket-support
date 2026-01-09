import { BotContext } from '../../types';
import { Ticket, TicketStatus, ITicket } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';
import { escapeMarkdown } from '../../utils/formatters';
import { downloadAndUploadToS3 } from '../../services/s3Service';

/**
 * Handles all messages from users in private chat
 */
export async function handleUserMessage(ctx: BotContext): Promise<void> {
  if (ctx.chat?.type !== 'private') return;
  if (ctx.message?.text?.startsWith('/')) return;
  if (!ctx.message || !ctx.from) return;
  
  const userId = ctx.from.id;
  
  try {
    const activeTicket = await Ticket.findOne({
      userId,
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] }
    }).sort({ createdAt: -1 });
    
    if (activeTicket) {
      console.log(`📨 User ${userId} replying to existing ticket ${activeTicket.ticketId}`);
      await forwardUserMessageToTopic(ctx, activeTicket);
    } else {
      console.log(`🎫 Creating new ticket for user ${userId}`);
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
  
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  
  // Create ticket in database
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
  
  // Create forum topic
  const topicName = `${ticket.ticketId} - ${user.first_name}`;
  
  try {
    const forumTopic = await ctx.api.createForumTopic(
      config.groups.technician_group_id,
      topicName,
      { icon_color: 0x6FB9F0 }
    );
    
    ticket.topicId = forumTopic.message_thread_id;
    ticket.topicName = topicName;
    
    // Send initial message to topic
    const initialTopicMessage = formatInitialTopicMessage(ticket, user, messageText);
    
    const sentMessage = await ctx.api.sendMessage(
      config.groups.technician_group_id,
      initialTopicMessage,
      {
        message_thread_id: ticket.topicId,
        parse_mode: 'Markdown'
      }
    );
    
    // Handle media upload to S3
    let s3Key: string | undefined;
    let s3Url: string | undefined;
    
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
        
        // Forward media to topic
        await ctx.api.copyMessage(
          config.groups.technician_group_id,
          ctx.chat!.id,
          message.message_id,
          { message_thread_id: ticket.topicId }
        );
      } catch (error) {
        console.error('Failed to upload media to S3:', error);
        // Continue without S3 - we still have fileId
      }
    }
    
    // Save to transcript
    ticket.messages.push({
      from: 'user',
      text: messageText,
      timestamp: new Date(),
      userMessageId: message.message_id,
      topicMessageId: sentMessage.message_id,
      hasMedia,
      mediaType,
      fileId,
      s3Key,
      s3Url
    });
    
    await ticket.save();
    
    await ctx.reply(
      `✅ *Ticket Created: ${ticket.ticketId}*\n\n` +
      `Your message has been sent to our support team.\n` +
      `Continue chatting here - all messages will be forwarded automatically.`,
      { 
        parse_mode: 'Markdown',
        reply_to_message_id: message.message_id
      }
    );
    
    console.log(
      `✅ Created ticket ${ticket.ticketId} for user ${user.id} ` +
      `(topicId: ${ticket.topicId}${s3Url ? ', media stored in S3' : ''})`
    );
    
  } catch (error) {
    console.error('Error creating forum topic:', error);
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
  
  if (!ticket.topicId) {
    console.log(`⚠️ Ticket ${ticket.ticketId} has no topicId, closing and creating new ticket`);
    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    await ticket.save();
    
    await ctx.reply(
      '⚠️ Your previous ticket was incomplete. Creating a new ticket...',
      { reply_to_message_id: message.message_id }
    );
    
    return createNewTicketWithTopic(ctx);
  }
  
  const messageText = extractMessageText(message);
  const { hasMedia, mediaType, fileId } = extractMediaInfo(message);
  const user = ctx.from!;
  
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
        
        // Copy media to topic
        sentMessage = await ctx.api.copyMessage(
          ticket.techGroupChatId,
          ctx.chat!.id,
          message.message_id,
          {
            message_thread_id: ticket.topicId,
            caption: messageText ? `📨 *From ${user.username} (${ticket.ticketId}):*\n\n${messageText}` : undefined,
            parse_mode: 'Markdown'
          }
        );
      } catch (error) {
        console.error('Failed to upload media to S3:', error);
        // Continue without S3 - still forward the message
        sentMessage = await ctx.api.copyMessage(
          ticket.techGroupChatId,
          ctx.chat!.id,
          message.message_id,
          {
            message_thread_id: ticket.topicId,
            caption: messageText ? `📨 *From ${user.username} (${ticket.ticketId}):*\n\n${messageText}` : undefined,
            parse_mode: 'Markdown'
          }
        );
      }
    } else {
      // Send text message
      sentMessage = await ctx.api.sendMessage(
        ticket.techGroupChatId,
        `📨 *From ${user.username} (${ticket.ticketId}):*\n\n${messageText}`,
        {
          message_thread_id: ticket.topicId,
          parse_mode: 'Markdown'
        }
      );
    }
    
    // Save to transcript
    ticket.messages.push({
      from: 'user',
      text: messageText,
      timestamp: new Date(),
      userMessageId: message.message_id,
      topicMessageId: sentMessage.message_id,
      hasMedia,
      mediaType,
      fileId,
      s3Key,
      s3Url
    });
    
    await ticket.save();
    
    console.log(
      `✅ Forwarded user message to topic for ticket ${ticket.ticketId}` +
      `${s3Url ? ' (media stored in S3)' : ''}`
    );
    
  } catch (error: any) {
    console.error('Error forwarding to topic:', error);
    
    if (
      error.description?.includes('thread not found') || 
      error.description?.includes('message thread not found')
    ) {
      console.log(`⚠️ Topic for ticket ${ticket.ticketId} was deleted, closing and creating new ticket`);
      ticket.status = TicketStatus.CLOSED;
      ticket.closedAt = new Date();
      await ticket.save();
      
      await ctx.reply(
        '⚠️ Your ticket topic was deleted. Creating a new ticket...',
        { reply_to_message_id: message.message_id }
      );
      
      return createNewTicketWithTopic(ctx);
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

function formatInitialTopicMessage(
  ticket: ITicket,
  user: any,
  messageText: string
): string {
  return (
    `🎫 *New Ticket*\n\n` +
    `👤 *User:* ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` +
    `${escapeMarkdown(user.username) ? ` (@${escapeMarkdown(user.username)})` : ''}\n` +
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