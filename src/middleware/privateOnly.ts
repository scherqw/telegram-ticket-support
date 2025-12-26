import { NextFunction } from 'grammy';
import { BotContext } from '../types';

/**
 * Middleware that restricts command to private chats only
 * Silently ignores in groups
 */
export async function privateOnly(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  if (ctx.chat?.type === 'private') {
    return next();
  }
  // Silently ignore in groups
}

/**
 * Alternative: Shows message in groups
 */
export async function privateOnlyWithMessage(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  if (ctx.chat?.type === 'private') {
    return next();
  }

  await ctx.reply(
    '⚠️ This command only works in private messages. Please DM me directly.',
    { reply_to_message_id: ctx.message?.message_id }
  );
}