import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../types';
import { Ticket } from '../../database/models/Ticket';

/**
 * Sends rating request to user after ticket is closed
 * * @param userId - Telegram user ID
 * @param ticketId - Ticket ID (e.g., "TICK-0001")
 * @param botApi - Bot API instance
 */
export async function sendRatingRequest(
  userId: number,
  ticketId: string,
  botApi: any
): Promise<void> {
  try {
    // Build star rating keyboard
    const keyboard = new InlineKeyboard()
      .text('⭐ 1', `rate:${ticketId}:1`)
      .text('⭐⭐ 2', `rate:${ticketId}:2`)
      .text('⭐⭐⭐ 3', `rate:${ticketId}:3`)
      .row()
      .text('⭐⭐⭐⭐ 4', `rate:${ticketId}:4`)
      .text('⭐⭐⭐⭐⭐ 5', `rate:${ticketId}:5`)
      .row()
      .text('⏭️ Skip', `rate:${ticketId}:skip`);

    await botApi.sendMessage(
      userId,
      '⭐ *Rate Your Experience*\n\n' +
      'How would you rate the support you received?\n' +
      'Your feedback helps us improve our service.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    console.log(`⭐ Rating request sent to user ${userId} for ${ticketId}`);

  } catch (error: any) {
    // Don't throw - rating is optional, don't break closure flow
    console.error(`Failed to send rating request to user ${userId}:`, error.message);
  }
}

/**
 * Handles rating callback when user clicks stars
 */
export async function handleRatingCallback(ctx: BotContext): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData || !callbackData.startsWith('rate:')) {
    await ctx.answerCallbackQuery('❌ Invalid rating');
    return;
  }

  // Parse: rate:TICK-0001:5
  const parts = callbackData.split(':');
  const ticketId = parts[1];
  const ratingValue = parts[2];

  try {
    // Handle skip
    if (ratingValue === 'skip') {
      await ctx.answerCallbackQuery('👍 Thanks anyway!');
      await ctx.editMessageText(
        '✅ Thank you for using our support service!\n\n' +
        'Feel free to create a new ticket anytime you need help.',
        { parse_mode: 'Markdown' }
      );
      console.log(`⏭️  User ${ctx.from?.id} skipped rating for ${ticketId}`);
      return;
    }

    const stars = parseInt(ratingValue);

    // Validate rating
    if (isNaN(stars) || stars < 1 || stars > 5) {
      await ctx.answerCallbackQuery('❌ Invalid rating value');
      return;
    }

    // Find ticket
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      await ctx.answerCallbackQuery('❌ Ticket not found');
      await ctx.editMessageText(
        '❌ This ticket could not be found.\n' +
        'It may have been deleted.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Check if already rated
    if (ticket.rating && ticket.rating.stars) {
      await ctx.answerCallbackQuery('✅ Already rated');
      await ctx.editMessageText(
        `✅ You already rated this ticket with ${getStarEmoji(ticket.rating.stars)}.\n\n` +
        'Thank you for your feedback!',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Save rating
    ticket.rating = {
      stars,
      ratedAt: new Date()
    };
    
    // Explicitly mark modified if needed, though reassignment usually handles it
    ticket.markModified('rating'); 
    
    await ticket.save();

    // Thank user
    await ctx.answerCallbackQuery(`✅ Rated ${stars} stars`);

    await ctx.editMessageText(
        `✅ You rated this ticket with ${getStarEmoji(stars)}.\n\n` +
        'Thank you for your feedback!',
        { parse_mode: 'Markdown' }
      );

    console.log(`⭐ User ${ctx.from?.id} rated ${ticketId} with ${stars} stars`);

    // Optional: Notify tech group of low ratings
    // if (stars <= 2) {
    //   await notifyLowRating(ctx, ticket, stars);
    // }

  } catch (error) {
    console.error('Error handling rating:', error);
    await ctx.answerCallbackQuery('❌ Error saving rating');
  }
}

/**
 * Get star emoji representation
 */
function getStarEmoji(stars: number): string {
  return '⭐'.repeat(stars);
}

/**
 * Notify tech group of low ratings (1-2 stars)
 */
// async function notifyLowRating(
//   ctx: BotContext,
//   ticket: any,
//   stars: number
// ): Promise<void> {
//   try {
//     const starEmoji = getStarEmoji(stars);
//     const userName = ticket.firstName + 
//       (ticket.lastName ? ' ' + ticket.lastName : '') +
//       (ticket.username ? ` (@${ticket.username})` : '');

//     const alertMessage = (
//       `⚠️ *Low Rating Alert*\n\n` +
//       `Ticket: ${ticket.ticketId}\n` +
//       `User: ${userName}\n` +
//       `Rating: ${starEmoji} (${stars}/5)\n` +
//       `Assigned to: ${ticket.assignedToName || 'Unassigned'}\n\n` +
//       `Please review this ticket to identify areas for improvement.`
//     );

//     await ctx.api.sendMessage(
//       ticket.techGroupChatId,
//       alertMessage,
//       { parse_mode: 'Markdown' }
//     );

//     console.log(`⚠️  Low rating alert sent for ${ticket.ticketId}`);

//   } catch (error) {
//     console.error('Failed to send low rating alert:', error);
//     // Don't throw - this is just a notification
//   }
// }