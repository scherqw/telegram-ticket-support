import { BotContext } from '../../types';
import { loadConfig } from '../../config/loader';

/**
 * Handles /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  await ctx.reply(config.messages.welcome, { parse_mode: 'Markdown' });
}