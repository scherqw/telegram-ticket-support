import { NextFunction } from 'grammy';
import { BotContext } from '../types';

/**
 * Middleware that restricts command to groups only
 */
export async function groupOnly(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  const chatType = ctx.chat?.type;
  
  if (chatType === 'group' || chatType === 'supergroup') {
    return next();
  }

  await ctx.reply('⚠️ This command only works in groups.');
}
