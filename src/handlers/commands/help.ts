import { BotContext } from '../../types';
import { loadConfig } from '../../config/loader';

/**
 * Handles /help command
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  await ctx.reply(config.messages.help_private, { parse_mode: 'Markdown' });
}