import { BotContext } from '../../types';
import { loadConfig } from '../../config/loader';
import { isPrivateChat } from '../../utils/chatContext';

/**
 * Handles /help command
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  const message = isPrivateChat(ctx) 
    ? config.messages.help_private 
    : config.messages.help_group;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}