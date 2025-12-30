import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../types';
import { FAQ } from '../../database/models/FAQ';

/**
 * Shows FAQ categories as the initial menu
 * 
 * Flow: /faq command → Display categories
 */
export async function showFAQMenu(ctx: BotContext): Promise<void> {
  try {
    // Get all unique categories from active FAQs
    const categories = await FAQ.distinct('category', { isActive: true });

    if (categories.length === 0) {
      await ctx.reply('❌ No FAQs available at the moment.');
      return;
    }

    // Build keyboard with categories
    const keyboard = new InlineKeyboard();
    
    // Sort categories alphabetically for better UX
    categories.sort().forEach(category => {
      keyboard.text(`📁 ${category}`, `faq:category:${category}`).row();
    });

    await ctx.reply(
      '📚 *Frequently Asked Questions*\n\n' +
      'Please select a category:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    console.log(`📚 FAQ menu opened by user ${ctx.from?.id}`);

  } catch (error) {
    console.error('Error showing FAQ menu:', error);
    await ctx.reply('❌ Error loading FAQs. Please try again.');
  }
}