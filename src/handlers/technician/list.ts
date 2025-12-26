import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { formatTicketStatus, formatDate, truncate } from '../../utils/formatters';

/**
 * Lists all open tickets
 */
export async function listOpenTickets(ctx: BotContext): Promise<void> {
  try {
    const tickets = await Ticket.find({
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] }
    })
      .sort({ createdAt: 1 })
      .limit(20);

    if (tickets.length === 0) {
      await ctx.reply('✅ No open tickets!');
      return;
    }

    let message = '📋 *Open Tickets*\n\n';

    tickets.forEach(ticket => {
      const assigned = ticket.assignedToName 
        ? ` (${ticket.assignedToName})` 
        : ' (Unassigned)';
      
      message +=
        `${formatTicketStatus(ticket.status)} *${ticket.ticketId}*${assigned}\n` +
        `   User: ${ticket.firstName}${ticket.username ? ` (@${ticket.username})` : ''}\n` +
        `   ${truncate(ticket.subject, 60)}\n` +
        `   _${formatDate(ticket.createdAt)}_\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error listing tickets:', error);
    await ctx.reply('❌ Failed to load tickets.');
  }
}