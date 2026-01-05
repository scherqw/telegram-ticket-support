import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';
import { sendRatingRequest } from '../rating/ratingHandler';
import { showCategorySelection } from '../categorization/categoryHandler';

/**
 * Closes a ticket with optional categorization and archiving
 * 
 * Flow:
 * 1. /close command
 * 2. Send rating request to user (immediate)
 * 3. Show category selection to tech (if enabled)
 * 4. Wait for categorization
 * 5. Archive ticket (if enabled)
 * 6. Close ticket and schedule deletion
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
    
    // ===== STEP 2: Send rating request immediately (if enabled) =====
    // This happens in parallel with categorization!
    if (config.features.enable_ratings) {
      try {
        await ctx.api.sendMessage(
          ticket.userId,
          `✅ *Ticket Closed: ${ticket.ticketId}*\n\n` +
          `Your support ticket has been resolved.\n\n` +
          `If you need further assistance, just send a new message to create another ticket.\n\n` +
          `Thank you for contacting support!`,
          { parse_mode: 'Markdown' }
        );
        
        // Send rating request immediately
        setTimeout(async () => {
          await sendRatingRequest(ticket.userId, ticket.ticketId, ctx.api);
        }, 1000);
      } catch (error) {
        console.error('Could not notify user:', error);
      }
    }
    
    // ===== STEP 3: Show categorization (if enabled and not already categorized) =====
    if (config.features.enable_categorization) {
      if (!ticket.categories || ticket.categories.length === 0) {
        // Show category selection and wait for user to complete it
        await showCategorySelection(ctx, ticket.ticketId);
        return; // Exit here - categorization callback will trigger final closure
      }
    }
    
    // ===== STEP 4: Close ticket directly (if categorization disabled or already categorized) =====
    await finalizeTicketClosure(ctx, ticket, config);
    
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
 * Finalizes ticket closure (called after categorization or directly if disabled)
 */
export async function finalizeTicketClosure(
  ctx: BotContext,
  ticket: any,
  config: any
): Promise<void> {
  const threadId = ticket.topicId;
  
  // ===== STEP 1: Close ticket =====
  ticket.status = TicketStatus.CLOSED;
  ticket.closedAt = new Date();
  
  // Schedule deletion for 24 hours from now
  const hoursUntilDeletion = config.features.topic_cleanup_hours || 24;
  ticket.topicDeletionScheduledAt = new Date(
    Date.now() + hoursUntilDeletion * 60 * 60 * 1000
  );
  
  await ticket.save();

  // ===== STEP 2: Archive ticket (if enabled) =====
  if (config.features.enable_archiving) {
    try {
      // Dynamic import to avoid circular dependency
      const { archiveTicket } = await import('../archive/archiveHandler');
      await archiveTicket(ticket, ctx.api);
    } catch (error) {
      console.error('Error archiving ticket:', error);
      // Continue even if archiving fails
    }
  }
  
  
  // ===== STEP 3: Confirm in topic =====
  const categoryInfo = ticket.categories && ticket.categories.length > 0
    ? `\n📂 Categories: ${ticket.categories.join(', ')}`
    : '';
  
  const ratingInfo = config.features.enable_ratings
    ? ' and asked to rate their experience'
    : '';
  
  const archiveInfo = config.features.enable_archiving && ticket.archiveTopicId
    ? `\n📦 Archived to topic ${ticket.archiveTopicId}`
    : '';
  
  await ctx.api.sendMessage(
    config.groups.technician_group_id,
    `✅ *Ticket Closed*\n\n` +
    `Ticket ${ticket.ticketId} has been closed.\n` +
    `User has been notified${ratingInfo}.${categoryInfo}${archiveInfo}\n\n` +
    `⏰ This topic will be automatically deleted in ${hoursUntilDeletion} hours.\n` +
    `📝 The full transcript is saved in the database.`,
    { 
      message_thread_id: threadId,
      parse_mode: 'Markdown'
    }
  );
  
  console.log(
    `✅ Ticket ${ticket.ticketId} closed by ${ctx.from?.first_name} ` +
    `${categoryInfo ? `(Categories: ${ticket.categories.join(', ')})` : ''}` +
    `${archiveInfo ? ` - Archived` : ''}`
  );
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