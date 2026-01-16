import { BotContext } from '../types';

export function isPrivateChat(ctx: BotContext): boolean {
  return ctx.chat?.type === 'private';
}

export function isGroupChat(ctx: BotContext): boolean {
  const chatType = ctx.chat?.type;
  return chatType === 'group' || chatType === 'supergroup';
}

export function getSafeIdentifier(ctx: BotContext): string {
  if (!ctx.from) return 'Unknown User';
  
  const username = ctx.from.username ? `@${ctx.from.username}` : '';
  const firstName = ctx.from.first_name || 'User';
  const userId = ctx.from.id;
  
  return `${firstName} ${username} (${userId})`;
}

export function getChatTypeString(ctx: BotContext): string {
  const type = ctx.chat?.type;
  switch (type) {
    case 'private': return 'Private DM';
    case 'group': return 'Group';
    case 'supergroup': return 'Supergroup';
    case 'channel': return 'Channel';
    default: return 'Unknown';
  }
}