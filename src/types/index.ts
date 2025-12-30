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
    username: string;  // NEW: For FAQ instructions
    parse_mode: 'Markdown' | 'HTML';
  };
  database: {
    uri: string;
  };
  groups: {
    technician_group_id: number;
  };
  topics: {
    general_topic_id: number;  // NEW: Permanent general discussion topic
  };
  admin: {
    owner_id: number;
  };
  features: {
    enable_faq: boolean;
    auto_create_ticket: boolean;  // NEW: Auto-create on first message
    topic_cleanup_hours: number;  // NEW: Hours before topic deletion
  };
  messages: {
    welcome: string;
    help_private: string;
    help_group: string;
  };
}