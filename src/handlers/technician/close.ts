import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';
import { sendRatingRequest } from '../rating/ratingHandler';
import { showCategorySelection } from '../categorization/categoryHandler';

/**
 * Closes a ticket with optional categorization and archiving
 * 
 * Flow:
 * 1. /close command in ticket topic
 * 2. Send rating request to user (immediate)
 * 3. Show category selection to tech (if enabled AND categories exist)
 * 4. Wait for categorization (callback handler will continue the flow)
 * 5. Archive ticket (if enabled)
 * 6. Delete topic immediately after archiving
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
  if (config.topics?.general_topic_id && threadId === config.topics.general_topic_id) {
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
        `ℹ️ Ticket ${ticket.ticketId} is already closed.`,
        { 
          message_thread_id: threadId,
          reply_to_message_id: ctx.message?.message_id
        }
      );
      return;
    }
    
    // ===== STEP 2: Send rating request immediately (if enabled) =====
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
        
        // Send rating request after a short delay
        setTimeout(async () => {
          try {
            await sendRatingRequest(ticket.userId, ticket.ticketId, ctx.api);
          } catch (error) {
            console.error('Could not send rating request:', error);
          }
        }, 1000);
      } catch (error) {
        console.error('Could not notify user:', error);
      }
    }

    // ===== STEP 3: Check if categorization is needed =====

    const shouldShowCategorization = 
      config.features.enable_categorization && 
      config.categories && 
      Array.isArray(config.categories) &&
      config.categories.length > 0 &&
      (!ticket.categories || ticket.categories.length === 0);
    
    if (shouldShowCategorization) {
      // Show category selection and WAIT for callback
      console.log(`📂 Showing category selection for ticket ${ticket.ticketId}`);
      await showCategorySelection(ctx, ticket.ticketId);
      return;
    }
    
    // ===== STEP 4: Close ticket directly (no categorization needed) =====
    console.log(`✅ Closing ticket ${ticket.ticketId} without categorization`);
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
 * Finalizes ticket closure - called after categorization OR directly if not needed
 * This handles: database update → archiving → topic deletion → confirmation
 */
export async function finalizeTicketClosure(
  ctx: BotContext,
  ticket: any,
  config: any
): Promise<void> {
  const threadId = ticket.topicId;
  const ticketId = ticket.ticketId;
  
  console.log(`🔄 Finalizing closure for ticket ${ticketId}...`);
  
  try {
    // ===== STEP 1: Update ticket status in database =====
    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    await ticket.save();
    console.log(`✅ Ticket ${ticketId} marked as closed in database`);
    
    // ===== STEP 2: Archive ticket (if enabled) =====
    let archiveSuccess = false;
    let archiveTopicId = null;
    
    if (config.features.enable_archiving && config.groups.archive_group_id) {
      try {
        console.log(`📦 Starting archive process for ticket ${ticketId}...`);
        
        // Dynamic import to avoid circular dependency
        const { archiveTicket } = await import('../archive/archiveHandler');
        await archiveTicket(ticket, ctx.api);
        
        // Fetch fresh ticket data to get updated archive info
        const updatedTicket = await Ticket.findOne({ ticketId: ticket.ticketId });
        if (updatedTicket && updatedTicket.archiveTopicId) {
          archiveTopicId = updatedTicket.archiveTopicId;
          archiveSuccess = true;
          console.log(`✅ Ticket ${ticketId} archived successfully to topic ${archiveTopicId}`);
        } else {
          console.log(`⚠️ Archive completed but archiveTopicId not found for ${ticketId}`);
        }
      } catch (error: any) {
        console.error(`❌ Error archiving ticket ${ticketId}:`, error.message);
        // Continue even if archiving fails - we'll still close the topic
      }
    } else {
      console.log(`ℹ️ Archiving disabled or archive_group_id not configured for ticket ${ticketId}`);
    }
    
    // ===== STEP 3: Delete the forum topic immediately =====
    let deletionSuccess = false;
    
    if (threadId) {
      try {
        console.log(`🗑️ Attempting to delete topic ${threadId} for ticket ${ticketId}...`);
        
        await ctx.api.deleteForumTopic(
          config.groups.technician_group_id,
          threadId
        );
        
        deletionSuccess = true;
        console.log(`✅ Topic ${threadId} deleted successfully for ticket ${ticketId}`);
        
        // Clear topic info from ticket since it's deleted
        ticket.topicId = undefined;
        ticket.topicName = undefined;
        await ticket.save();
        
      } catch (error: any) {
        console.error(`❌ Failed to delete topic ${threadId}:`, error.message);
        
        // If topic already deleted or doesn't exist, clear it from DB anyway
        if (
          error.description?.includes('thread not found') ||
          error.description?.includes('not found') ||
          error.description?.includes('deleted')
        ) {
          ticket.topicId = undefined;
          ticket.topicName = undefined;
          await ticket.save();
          console.log(`ℹ️ Topic ${threadId} already deleted, cleared from DB`);
          deletionSuccess = true; // Consider it a success
        }
      }
    } else {
      console.log(`⚠️ No topicId found for ticket ${ticketId}, skipping deletion`);
    }
    
    // ===== STEP 4: Send confirmation =====
    const categoryInfo = ticket.categories && ticket.categories.length > 0
      ? `\n📂 Categories: ${ticket.categories.join(', ')}`
      : '';
    
    const ratingInfo = config.features.enable_ratings
      ? ' User notified and asked to rate.'
      : ' User notified.';
    
    const archiveInfo = archiveSuccess && archiveTopicId
      ? `\n📦 Archived to topic ${archiveTopicId} in archive group`
      : config.features.enable_archiving && !archiveSuccess
      ? `\n⚠️ Archive failed - check logs`
      : '';
    
    const deletionInfo = deletionSuccess
      ? `\n🗑️ Topic deleted from technician group`
      : `\n⚠️ Topic deletion failed - may need manual cleanup`;

    // ===== FINAL LOG =====
    console.log(
      `✅ CLOSURE COMPLETE for ${ticketId}` +
      ` | Closed by: ${ctx.from?.first_name || 'Unknown'}` +
      `${categoryInfo ? ` | Categories: ${ticket.categories.join(', ')}` : ' | No categories'}` +
      ` | Archived: ${archiveSuccess ? 'Yes' : 'No'}` +
      ` | Topic deleted: ${deletionSuccess ? 'Yes' : 'No'}`
    );
    
  } catch (error: any) {
    console.error(`❌ Critical error in finalizeTicketClosure for ${ticketId}:`, error);
    
    // Try to send error message
    try {
      await ctx.api.sendMessage(
        config.groups.technician_group_id,
        `❌ *Error closing ticket ${ticketId}*\n\n` +
        `An error occurred while closing the ticket. Please check the logs.\n\n` +
        `Error: ${error.message}`,
        { 
          parse_mode: 'Markdown'
        }
      );
    } catch (notifError) {
      console.error('Could not send error notification:', notifError);
    }
  }
}