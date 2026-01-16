import { Context as GrammyContext } from 'grammy';

export type BotContext = GrammyContext;

export interface BotConfig {
  bot: {
    token: string;
    username: string;
    parse_mode: 'Markdown' | 'HTML';
  };
  database: {
    uri: string;
  };
  webapp: {
    url: string;
    port: number;
  };
  admin: {
    owner_id: number;
    technician_ids: number[];
  };
  features: {
    enable_faq: boolean;
    enable_ratings: boolean;
    enable_categorization: boolean;
  };
  categories: TicketCategory[];
  messages: {
    welcome: string;
    help_private: string;
  };
}

export interface TicketCategory {
  id: string;
  label: string;
  description?: string;
}