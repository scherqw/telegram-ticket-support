import { Context as GrammyContext, SessionFlavor } from 'grammy';

/**
 * Session data structure
 */
export interface SessionData {
  awaitingTicket?: boolean;
  currentTicketId?: string;
}

/**
 * Extended bot context with session
 */
// export interface BotContext extends GrammyContext {
//   session?: SessionData;
// }

export type BotContext = GrammyContext & SessionFlavor<SessionData>;

/**
 * Bot configuration interface
 */
export interface BotConfig {
  bot: {
    token: string;
    parse_mode: 'Markdown' | 'HTML';
  };
  database: {
    uri: string;
  };
  groups: {
    technician_group_id: number;
  };
  admin: {
    owner_id: number;
  };
  features: {
    enable_group_faq: boolean;
    enable_private_tickets: boolean;
    show_ticket_ids: boolean;
  };
  messages: {
    welcome: string;
    help_private: string;
    help_group: string;
  };
}