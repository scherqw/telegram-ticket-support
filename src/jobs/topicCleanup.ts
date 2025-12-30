import { Bot } from 'grammy';
import { BotContext } from '../types';
import { Ticket, TicketStatus } from '../database/models/Ticket';

/**
 * Background job to delete closed ticket topics after scheduled time
 * 
 * This job:
 * 1. Finds tickets with topicDeletionScheduledAt <= now
 * 2. Deletes the forum topic
 * 3. Clears topicId from ticket (transcript remains)
 * 
 * Run frequency: Every hour
 */
export async function startTopicCleanupJob(bot: Bot<BotContext>): Promise<void> {
  console.log('🧹 Starting topic cleanup job...');
  
  // Run immediately on startup
  await runCleanup(bot);
  
  // Then run every hour
  setInterval(async () => {
    await runCleanup(bot);
  }, 60 * 60 * 1000); // 1 hour in milliseconds
}

/**
 * Executes the cleanup logic
 */
async function runCleanup(bot: Bot<BotContext>): Promise<void> {
  try {
    const now = new Date();
    
    // Find tickets scheduled for cleanup
    const ticketsToCleanup = await Ticket.find({
      status: TicketStatus.CLOSED,
      topicDeletionScheduledAt: { $lte: now },
      topicId: { $exists: true, $ne: null }
    }).limit(100); // Process in batches
    
    if (ticketsToCleanup.length === 0) {
      console.log('🧹 No topics to clean up');
      return;
    }
    
    console.log(`🧹 Found ${ticketsToCleanup.length} topics to clean up`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const ticket of ticketsToCleanup) {
      try {
        // Delete the forum topic
        await bot.api.deleteForumTopic(
          ticket.techGroupChatId,
          ticket.topicId!
        );
        
        // Clear topicId but keep transcript
        ticket.topicId = undefined;
        ticket.topicName = undefined;
        await ticket.save();
        
        successCount++;
        console.log(`✅ Deleted topic for ticket ${ticket.ticketId}`);
        
        // Small delay to avoid rate limits
        await sleep(100);
        
      } catch (error: any) {
        failCount++;
        console.error(`❌ Failed to delete topic for ${ticket.ticketId}:`, error.message);
        
        // If topic already deleted or doesn't exist, clear it anyway
        if (
          error.description?.includes('thread not found') ||
          error.description?.includes('not found')
        ) {
          ticket.topicId = undefined;
          ticket.topicName = undefined;
          await ticket.save();
          console.log(`ℹ️  Topic already deleted for ${ticket.ticketId}, cleared from DB`);
        }
      }
    }
    
    console.log(
      `🧹 Cleanup complete: ${successCount} deleted, ${failCount} failed`
    );
    
  } catch (error) {
    console.error('❌ Cleanup job error:', error);
  }
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Manual cleanup trigger (for testing or emergency use)
 */
export async function triggerManualCleanup(bot: Bot<BotContext>): Promise<void> {
  console.log('🧹 Manual cleanup triggered');
  await runCleanup(bot);
}