import { BotContext } from '../../types';
import { FAQ } from '../../database/models/FAQ';
import { loadConfig } from '../../config/loader';

/**
 * Handles FAQ button clicks
 * 
 * NEW BEHAVIOR:
 * - No longer creates tickets
 * - Just shows answer + instructions to DM bot
 */
export async function handleFAQCallback(ctx: BotContext): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData || !callbackData.startsWith('faq:')) {
    await ctx.answerCallbackQuery('❌ Invalid selection');
    return;
  }

  const faqId = callbackData.split(':')[1];

  try {
    const faq = await FAQ.findById(faqId);

    if (!faq || !faq.isActive) {
      await ctx.answerCallbackQuery('❌ FAQ not found');
      return;
    }

    await ctx.answerCallbackQuery();
    
    const config = loadConfig();

    // Send answer with instructions to DM bot
    await ctx.reply(
      `*${faq.question}*\n\n` +
      `${faq.answer}\n\n` +
      `─────────────────\n` +
      `💡 *Need more help?*\n` +
      `Send @${config.bot.username} a direct message to create a support ticket!`,
      { parse_mode: 'Markdown' }
    );
    
    console.log(`📚 FAQ answered: "${faq.question}" for user ${ctx.from?.id}`);
    
  } catch (error) {
    console.error('Error handling FAQ callback:', error);
    await ctx.answerCallbackQuery('❌ Error loading FAQ');
  }
}
