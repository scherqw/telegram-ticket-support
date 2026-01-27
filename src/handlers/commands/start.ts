import { BotContext } from '../../types';
import { loadConfig } from '../../config/loader';

export async function handleStart(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  
  if (!ctx.from) return;

  const isTechnician = config.admin.technician_ids.includes(ctx.from.id);

  if (isTechnician) {
    await ctx.reply(
      '👨‍💼 *Welcome, Technician!*\n\n' +
      'Navigate to the ' + `[Support website](${config.webapp.url})` + ' to answer or close a ticket.\n\n' +
      'You can also use:\n' +
      '/faq - Manage FAQs',
      { parse_mode: 'Markdown' }
    );
  } else {
    // Set default commands menu for users
    await ctx.api.setChatMenuButton({
      chat_id: ctx.from.id,
      menu_button: {
        type: 'commands'
      }
    });

    await ctx.reply(config.messages.welcome, { parse_mode: 'Markdown' });
  }
}
