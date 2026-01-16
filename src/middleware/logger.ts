import { NextFunction } from 'grammy';
import { BotContext } from '../types';

export async function logger(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  const user = ctx.from
    ? `${ctx.from.first_name}${ctx.from.username ? ` (@${ctx.from.username})` : ''} [${ctx.from.id}]`
    : 'Unknown';
  
  const chatType = ctx.chat?.type || 'unknown';
  const chatId = ctx.chat?.id || 'unknown';
  
  let message = 'interaction';
  if (ctx.message?.text) {
    message = ctx.message.text.substring(0, 50);
  } else if (ctx.callbackQuery) {
    message = `callback: ${ctx.callbackQuery.data}`;
  }
  
  console.log(`📨 [${chatType}:${chatId}] ${user}: ${message}`);
  
  await next();
}