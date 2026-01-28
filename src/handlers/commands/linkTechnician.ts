import { BotContext } from '../../types';
import { authState } from '../../services/authState';

export async function handleLinkCommand(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;

  // Expect command: /link 123456
  const args = ctx.message?.text?.split(' ');
  const code = args?.[1];

  if (!code || code.length !== 6) {
    await ctx.reply('⚠️ Invalid format. Usage: `/link 123456`', { parse_mode: 'Markdown' });
    return;
  }

  const isValid = authState.verifyCode(code);
  if (!isValid) {
    await ctx.reply('❌ This code is invalid or has expired. Please generate a new one on the web dashboard.');
    return;
  }

  if (isValid.status === 'linked') {
    await ctx.reply('⚠️ This code has already been used.');
    return;
  }

  // Link the user
  const technicianData = {
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name
  };

  const success = authState.linkUser(code, technicianData);

  if (success) {
    await ctx.reply(
      `✅ *Account Linked Successfully!*\n\n` +
      `You are now authenticated as *${ctx.from.first_name}*.\n` +
      `The web dashboard should update automatically.`,
      { parse_mode: 'Markdown' }
    );
    console.log(`🔗 Technician linked: ${ctx.from.id} via code ${code}`);
  } else {
    await ctx.reply('❌ Failed to link account. Please try again.');
  }
}