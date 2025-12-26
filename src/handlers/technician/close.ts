// import { BotContext } from '../../types';
// import { Ticket, TicketStatus } from '../../database/models/Ticket';

// /**
//  * Closes a ticket
//  */
// export async function closeTicket(ctx: BotContext): Promise<void> {
//   if (!ctx.message || !('reply_to_message' in ctx.message) || !ctx.message.reply_to_message) {
//     await ctx.reply('⚠️ Reply to a ticket message to close it.');
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

//     if (ticket.status === TicketStatus.CLOSED) {
//       await ctx.reply(`ℹ️ Ticket ${ticket.ticketId} is already closed.`);
//       return;
//     }

//     // Close ticket
//     ticket.status = TicketStatus.CLOSED;
//     ticket.closedAt = new Date();
//     await ticket.save();

//     // Notify user
//     await ctx.api.sendMessage(
//       ticket.userId,
//       `✅ *Ticket Closed: ${ticket.ticketId}*\n\n` +
//       'Your ticket has been resolved.\n\n' +
//       'Need more help? Create a new ticket with /ticket',
//       { parse_mode: 'Markdown' }
//     );

//     // Confirm
//     await ctx.reply(
//       `✅ Ticket ${ticket.ticketId} closed.\n` +
//       `User has been notified.`
//     );

//     console.log(`✅ Ticket ${ticket.ticketId} closed by ${ctx.from?.first_name}`);

//   } catch (error) {
//     console.error('Error closing ticket:', error);
//     await ctx.reply('❌ Failed to close ticket.');
//   }
// }

import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';

/**
 * Closes a ticket
 */
export async function closeTicket(ctx: BotContext): Promise<void> {
  if (!ctx.message || !('reply_to_message' in ctx.message) || !ctx.message.reply_to_message) {
    await ctx.reply('⚠️ Reply to a ticket message to close it.');
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

    if (ticket.status === TicketStatus.CLOSED) {
      await ctx.reply(`ℹ️ Ticket ${ticket.ticketId} is already closed.`);
      return;
    }

    // Close ticket
    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    await ticket.save();

    // Notify user
    await ctx.api.sendMessage(
      ticket.userId,
      `✅ *Ticket Closed: ${ticket.ticketId}*\n\n` +
      'Your ticket has been resolved.\n\n' +
      'Need more help? Create a new ticket with /ticket',
      { parse_mode: 'Markdown' }
    );

    // Confirm
    await ctx.reply(
      `✅ Ticket ${ticket.ticketId} closed.\n` +
      `User has been notified.`
    );

    console.log(`✅ Ticket ${ticket.ticketId} closed by ${ctx.from?.first_name}`);

  } catch (error) {
    console.error('Error closing ticket:', error);
    await ctx.reply('❌ Failed to close ticket.');
  }
}