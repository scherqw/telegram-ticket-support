import * as fs from 'fs';
import * as yaml from 'yaml';
import * as dotenv from 'dotenv';
import { BotConfig } from '../types';

// Load environment variables
dotenv.config();

/**
 * Loads and validates bot configuration
 */
export function loadConfig(): BotConfig {
  try {
    // Read YAML config file
    const configFile = fs.readFileSync('./config/config.yaml', 'utf8');
    const config = yaml.parse(configFile) as BotConfig;

    // Override with environment variables if present
    if (process.env.BOT_TOKEN) {
      config.bot.token = process.env.BOT_TOKEN;
    }
    if (process.env.MONGODB_URI) {
      config.database.uri = process.env.MONGODB_URI;
    }
    if (process.env.TECH_GROUP_ID) {
      config.groups.technician_group_id = Number(process.env.TECH_GROUP_ID);
    }
    if (process.env.OWNER_ID) {
      config.admin.owner_id = Number(process.env.OWNER_ID);
    }

    // Validate required fields
    validateConfig(config);

    return config;
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    throw error;
  }
}

/**
 * Validates configuration has all required fields
 */
function validateConfig(config: BotConfig): void {
  const required = [
    ['bot.token', config.bot?.token],
    ['database.uri', config.database?.uri],
    ['groups.technician_group_id', config.groups?.technician_group_id]
  ];

  const missing = required.filter(([_, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.map(([key]) => key).join(', ')}`
    );
  }
}
