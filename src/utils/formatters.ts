import { TicketStatus } from '../database/models/Ticket';

export function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTicketStatus(status: TicketStatus): string {
  switch (status) {
    case TicketStatus.OPEN:
      return '🟢 Open';
    case TicketStatus.IN_PROGRESS:
      return '🟡 In Progress';
    case TicketStatus.CLOSED:
      return '⚫ Closed';
    default:
      return status;
  }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*`[]/g, '\\$&');
}
