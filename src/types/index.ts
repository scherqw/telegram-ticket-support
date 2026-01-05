import { Context as GrammyContext } from 'grammy';

/**
 * Extended bot context
 * NOTE: Removed SessionFlavor - we use database state instead
 */
export type BotContext = GrammyContext;

/**
 * Bot configuration interface
 */
export interface BotConfig {
  bot: {
    token: string;
    username: string;
    parse_mode: 'Markdown' | 'HTML';
  };
  database: {
    uri: string;
  };
  groups: {
    technician_group_id: number;
    archive_group_id: number;      // NEW: Archive group for closed tickets
  };
  topics: {
    general_topic_id: number;
  };
  admin: {
    owner_id: number;
  };
  features: {
    enable_faq: boolean;
    auto_create_ticket: boolean;
    topic_cleanup_hours: number;
    enable_ratings: boolean;
    enable_categorization: boolean;
    enable_archiving: boolean;        // NEW: Enable archive system
  };
  categories: TicketCategory[];        // NEW
  messages: {
    welcome: string;
    help_private: string;
    help_group: string;
  };
}

/**
 * Ticket category configuration
 */
export interface TicketCategory {
  id: string;           // Internal ID (e.g., "account")
  label: string;        // Display name (e.g., "🔐 Account")
  emoji?: string;       // Optional separate emoji
  description?: string; // Optional description for techs
}