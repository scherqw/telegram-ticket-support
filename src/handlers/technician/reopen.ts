// import { BotContext } from '../../types';
// import { Ticket, TicketStatus } from '../../database/models/Ticket';

// /**
//  * Reopens a closed ticket
//  */
// export async function reopenTicket(ctx: BotContext): Promise<void> {
//   if (!ctx.message || !('reply_to_message' in ctx.message) || !ctx.message.reply_to_message) {
//     await ctx.reply('⚠️ Reply to a ticket message to reopen it.');
//     return;
//   }

//   const replyToMessageId = ctx.message.reply_to_message.message_id;

//   try {
//     const ticket = await Ticket.findOne({
//       techGroupMessageId: replyToMessageId
//     });

//     if (!ticket) {
//       await ctx.reply('❌ Ticket not found.');
//       return;
//     }

//     if (ticket.status !== TicketStatus.CLOSED) {
//       await ctx.reply(`ℹ️ Ticket ${ticket.ticketId} is not closed.`);
//       return;
//     }

//     // Reopen
//     ticket.status = TicketStatus.OPEN;
//     ticket.closedAt = undefined;
//     await ticket.save();

//     // Notify user
//     await ctx.api.sendMessage(
//       ticket.userId,
//       `🔄 *Ticket Reopened: ${ticket.ticketId}*\n\n` +
//       'Your ticket has been reopened. We will assist you shortly.',
//       { parse_mode: 'Markdown' }
//     );

//     // Confirm
//     await ctx.reply(`🔄 Ticket ${ticket.ticketId} reopened.`);

//     console.log(`🔄 Ticket ${ticket.ticketId} reopened by ${ctx.from?.first_name}`);

//   } catch (error) {
//     console.error('Error reopening ticket:', error);
//     await ctx.reply('❌ Failed to reopen ticket.');
//   }
// }

import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';

/**
 * Reopens a closed ticket
 */
export async function reopenTicket(ctx: BotContext): Promise<void> {
  if (!ctx.message || !('reply_to_message' in ctx.message) || !ctx.message.reply_to_message) {
    await ctx.reply('⚠️ Reply to a ticket message to reopen it.');
    return;
  }

  const replyToMessageId = ctx.message.reply_to_message.message_id;

  try {
    // FIX: Updated lookup to match any message in the thread
    const ticket = await Ticket.findOne({
      $or: [
        { techGroupMessageId: replyToMessageId },
        { 'messages.groupMessageId': replyToMessageId },
        { 'messages.messageId': replyToMessageId, 'messages.from': 'technician' }
      ]
    });

    if (!ticket) {
      await ctx.reply('❌ Ticket not found.');
      return;
    }

    if (ticket.status !== TicketStatus.CLOSED) {
      await ctx.reply(`ℹ️ Ticket ${ticket.ticketId} is not closed.`);
      return;
    }

    // Reopen
    ticket.status = TicketStatus.OPEN;
    ticket.closedAt = undefined;
    await ticket.save();

    // Notify user
    await ctx.api.sendMessage(
      ticket.userId,
      `🔄 *Ticket Reopened: ${ticket.ticketId}*\n\n` +
      'Your ticket has been reopened. We will assist you shortly.',
      { parse_mode: 'Markdown' }
    );

    // Confirm
    await ctx.reply(`🔄 Ticket ${ticket.ticketId} reopened.`);

    console.log(`🔄 Ticket ${ticket.ticketId} reopened by ${ctx.from?.first_name}`);

  } catch (error) {
    console.error('Error reopening ticket:', error);
    await ctx.reply('❌ Failed to reopen ticket.');
  }
}