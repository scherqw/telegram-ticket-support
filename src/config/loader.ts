import * as fs from 'fs';
import * as yaml from 'yaml';
import * as dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export function loadConfig(): BotConfig {
  try {
    const configFile = fs.readFileSync('./config/config.yaml', 'utf8');
    const config = yaml.parse(configFile) as BotConfig;

    // Override with environment variables
    if (process.env.BOT_TOKEN) {
      config.bot.token = process.env.BOT_TOKEN;
    }
    if (process.env.MONGODB_URI) {
      config.database.uri = process.env.MONGODB_URI;
    }
    if (process.env.OWNER_ID) {
      config.admin.owner_id = Number(process.env.OWNER_ID);
    }
    if (process.env.WEBAPP_URL) {
      config.webapp.url = process.env.WEBAPP_URL;
    }
    if (process.env.WEBAPP_PORT) {
      config.webapp.port = Number(process.env.WEBAPP_PORT);
    }
    if (process.env.TELEGRAM_APP_LINK) {
      config.webapp.telegram_link = process.env.TELEGRAM_APP_LINK;
    }
    if (process.env.TECHNICIAN_IDS) {
      config.admin.technician_ids = process.env.TECHNICIAN_IDS
        .split(',')
        .map(id => Number(id.trim()));
    }
    if (process.env.LEVEL2_IDS) {
      config.admin.level2_ids = process.env.LEVEL2_IDS
        .split(',')
        .map(id => Number(id.trim()));
    }

    validateConfig(config);
    return config;
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    throw error;
  }
}

function validateConfig(config: BotConfig): void {
  const required = [
    ['bot.token', config.bot?.token],
    ['database.uri', config.database?.uri],
    ['webapp.url', config.webapp?.url],
    ['admin.technician_ids', config.admin?.technician_ids?.length > 0]
  ];

  const missing = required.filter(([_, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.map(([key]) => key).join(', ')}`
    );
  }
}