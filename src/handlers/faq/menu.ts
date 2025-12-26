import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../types';
import { FAQ } from '../../database/models/FAQ';

/**
 * Shows FAQ menu with inline keyboard
 */
export async function showFAQMenu(ctx: BotContext): Promise<void> {
  try {
    const faqs = await FAQ.find({ isActive: true })
      .sort({ category: 1, order: 1 })
      .limit(20);

    if (faqs.length === 0) {
      await ctx.reply('❌ No FAQs available at the moment.');
      return;
    }

    // Group by category
    const categories = new Map<string, typeof faqs>();
    faqs.forEach(faq => {
      const cat = faq.category || 'General';
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat)!.push(faq);
    });

    // Build keyboard
    const keyboard = new InlineKeyboard();
    
    categories.forEach((faqList, category) => {
      // Category header if multiple categories
      if (categories.size > 1) {
        keyboard.text(`📁 ${category}`, `cat:${category}`).row();
      }
      
      // FAQ buttons
      faqList.forEach(faq => {
        const displayText = faq.question.length > 50
          ? faq.question.substring(0, 47) + '...'
          : faq.question;
        
        keyboard.text(displayText, `faq:${faq._id}`).row();
      });
    });

    await ctx.reply(
      '📚 *Frequently Asked Questions*\n\n' +
      'Select a question below:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  } catch (error) {
    console.error('Error showing FAQ menu:', error);
    await ctx.reply('❌ Error loading FAQs. Please try again.');
  }
}