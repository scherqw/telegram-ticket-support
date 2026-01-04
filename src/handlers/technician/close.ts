import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';
import { sendRatingRequest } from '../rating/ratingHandler';

/**
 * Closes a ticket and schedules topic for deletion
 * 
 * Usage: /close (inside a ticket topic)
 */
export async function closeTicket(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  
  // Must be in tech group
  if (ctx.chat?.id !== config.groups.technician_group_id) {
    return;
  }
  
  // Must be in a topic
  const threadId = ctx.message?.message_thread_id;
  if (!threadId) {
    await ctx.reply(
      '⚠️ Use this command inside a ticket topic.',
      { reply_to_message_id: ctx.message?.message_id }
    );
    return;
  }
  
  // Don't allow closing the general topic
  if (threadId === config.topics.general_topic_id) {
    await ctx.reply(
      '⚠️ Cannot close the general discussion topic.',
      { 
        message_thread_id: threadId,
        reply_to_message_id: ctx.message?.message_id
      }
    );
    return;
  }
  
  try {
    // ===== STEP 1: Find ticket =====
    const ticket = await Ticket.findOne({ topicId: threadId });
    
    if (!ticket) {
      await ctx.reply(
        '❌ Ticket not found for this topic.',
        { 
          message_thread_id: threadId,
          reply_to_message_id: ctx.message?.message_id
        }
      );
      return;
    }
    
    if (ticket.status === TicketStatus.CLOSED) {
      await ctx.reply(
        `ℹ️ Ticket ${ticket.ticketId} is already closed.\n` +
        `Topic will be deleted ${getTimeUntilDeletion(ticket.topicDeletionScheduledAt)}.`,
        { 
          message_thread_id: threadId,
          reply_to_message_id: ctx.message?.message_id
        }
      );
      return;
    }
    
    // ===== STEP 2: Close ticket =====
    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    
    // Schedule deletion for 24 hours from now
    const hoursUntilDeletion = config.features.topic_cleanup_hours || 24;
    ticket.topicDeletionScheduledAt = new Date(
      Date.now() + hoursUntilDeletion * 60 * 60 * 1000
    );
    
    await ticket.save();
    
    // ===== STEP 3: Notify user =====
    try {
      await ctx.api.sendMessage(
        ticket.userId,
        `✅ *Ticket Closed: ${ticket.ticketId}*\n\n` +
        `Your support ticket has been resolved.\n\n` +
        `If you need further assistance, just send a new message to create another ticket.\n\n` +
        `Thank you for contacting support!`,
        { parse_mode: 'Markdown' }
      );
      
      // ===== STEP 4: Send rating request (NEW) =====
      // Small delay to ensure closure message is delivered first
      setTimeout(async () => {
        await sendRatingRequest(ticket.userId, ticket.ticketId, ctx.api);
      }, 1000);
      
    } catch (error) {
      console.error('Could not notify user:', error);
      // Continue even if user notification fails
    }
    
    // ===== STEP 5: Confirm in topic =====
    await ctx.reply(
      `✅ *Ticket Closed*\n\n` +
      `Ticket ${ticket.ticketId} has been closed.\n` +
      `User has been notified and asked to rate their experience.\n\n` +
      `⏰ This topic will be automatically deleted in ${hoursUntilDeletion} hours.\n` +
      `📝 The full transcript is saved in the database.`,
      { 
        message_thread_id: threadId,
        parse_mode: 'Markdown'
      }
    );
    
    console.log(
      `✅ Ticket ${ticket.ticketId} closed by ${ctx.from?.first_name} ` +
      `(Topic deletion scheduled for ${ticket.topicDeletionScheduledAt.toLocaleString()})`
    );
    
  } catch (error) {
    console.error('Error closing ticket:', error);
    await ctx.reply(
      '❌ Failed to close ticket. Please try again.',
      { 
        message_thread_id: threadId,
        reply_to_message_id: ctx.message?.message_id
      }
    );
  }
}

/**
 * Helper: Get human-readable time until deletion
 */
function getTimeUntilDeletion(scheduledAt?: Date): string {
  if (!scheduledAt) return 'soon';
  
  const now = Date.now();
  const scheduled = scheduledAt.getTime();
  const hoursRemaining = Math.ceil((scheduled - now) / (1000 * 60 * 60));
  
  if (hoursRemaining <= 0) return 'very soon';
  if (hoursRemaining === 1) return 'in 1 hour';
  return `in ${hoursRemaining} hours`;
}