import { ITicket, TicketStatus } from '../../database/models/Ticket';
import { Bot } from 'grammy';

let botInstance: Bot | null = null;

export function setBotInstance(bot: Bot): void {
  botInstance = bot;
}

export async function sendMessageToUser(
  ticket: ITicket,
  message: string,
  technician: { id: number; first_name: string }
): Promise<void> {
  if (!botInstance) {
    throw new Error('Bot instance not initialized');
  }

  const techName = technician.first_name;

  const sentMessage = await botInstance.api.sendMessage(
    ticket.userId,
    `💬 *${techName}:*\n\n${message}`,
    { parse_mode: 'Markdown' }
  );

  if (ticket.status === TicketStatus.OPEN) {
    ticket.status = TicketStatus.IN_PROGRESS;
  }

  if (!ticket.assignedTo) {
    ticket.assignedTo = technician.id;
    ticket.assignedToName = techName;
  }

  ticket.messages.push({
    from: 'technician',
    text: message,
    timestamp: new Date(),
    userMessageId: sentMessage.message_id,
    technicianId: technician.id,
    technicianName: techName,
    hasMedia: false,
    isRead: true
  });

  ticket.lastMessageAt = new Date();
  await ticket.save();
}
