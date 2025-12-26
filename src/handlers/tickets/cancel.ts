import { BotContext } from '../../types';

/**
 * Cancels ongoing ticket creation
 */
export async function handleCancelCommand(ctx: BotContext): Promise<void> {
  if (ctx.session?.awaitingTicket) {
    ctx.session.awaitingTicket = false;
    await ctx.reply('❌ Ticket creation cancelled. Use /ticket to try again.');
  } else {
    await ctx.reply('ℹ️ Nothing to cancel.');
  }
}