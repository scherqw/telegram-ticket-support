import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { formatTicketStatus, formatDate } from '../../utils/formatters';

/**
 * Shows user's tickets
 */
export async function showUserTickets(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;

  try {
    const tickets = await Ticket.find({ userId: ctx.from.id })
      .sort({ createdAt: -1 })
      .limit(10);

    if (tickets.length === 0) {
      await ctx.reply('📭 No tickets yet. Just send me a message to create one!');
      return;
    }

    let message = '📋 *Your Recent Tickets*\n\n';

    tickets.forEach(ticket => {
      message +=
        `${formatTicketStatus(ticket.status)} *${ticket.ticketId}*\n` +
        `   ${ticket.initialMessage.substring(0, 60)}${ticket.initialMessage.length > 60 ? '...' : ''}\n` +
        `   _${formatDate(ticket.createdAt)}_\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    await ctx.reply('❌ Failed to load tickets.');
  }
}