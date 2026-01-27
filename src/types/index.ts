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
    telegram_link?: string;
  };
  auth: {
    jwt_secret: string;
    admin_password: string;
  };
  admin: {
    owner_id: number;
    technician_ids: number[];
    level2_ids?: number[];
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