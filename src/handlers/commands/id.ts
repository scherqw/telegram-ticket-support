import { BotContext } from '../../types';

/**
 * Handles /id command - shows user and chat IDs
 */
export async function handleId(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const chatType = ctx.chat?.type;
  const username = ctx.from?.username ? `@${ctx.from.username}` : 'N/A';
  
  await ctx.reply(
    `🆔 *Your Information*\n\n` +
    `User ID: \`${userId}\`\n` +
    `Username: ${username}\n` +
    `Chat ID: \`${chatId}\`\n` +
    `Chat Type: ${chatType}`,
    { parse_mode: 'Markdown' }
  );
}