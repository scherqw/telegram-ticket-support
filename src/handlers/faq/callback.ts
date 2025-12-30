import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../types';
import { FAQ } from '../../database/models/FAQ';
import { loadConfig } from '../../config/loader';
import { escapeMarkdown } from '../../utils/formatters';

/**
 * Handles FAQ button clicks with three-level navigation
 * 
 * Flow:
 * Level 1: Categories → Level 2: Questions → Level 3: Answer
 * 
 * Callback data format:
 * - faq:category:CategoryName
 * - faq:question:faqId
 * - faq:back:categories
 */
export async function handleFAQCallback(ctx: BotContext): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData || !callbackData.startsWith('faq:')) {
    await ctx.answerCallbackQuery('❌ Invalid selection');
    return;
  }

  // Parse callback data: faq:action:value
  const parts = callbackData.split(':');
  const action = parts[1];
  const value = parts.slice(2).join(':'); // Handle categories with colons in name

  try {
    if (action === 'category') {
      // User clicked a category → Show questions in that category
      await showCategoryQuestions(ctx, value);
    } else if (action === 'question') {
      // User clicked a question → Show the answer
      await showQuestionAnswer(ctx, value);
    } else if (action === 'back') {
      // User clicked back button → Return to categories
      await showCategories(ctx);
    } else {
      await ctx.answerCallbackQuery('❌ Unknown action');
    }
  } catch (error) {
    console.error('Error handling FAQ callback:', error);
    await ctx.answerCallbackQuery('❌ Error loading FAQ');
  }
}

/**
 * Shows categories (called from back button)
 */
async function showCategories(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  
  try {
    // Get all unique categories
    const categories = await FAQ.distinct('category', { isActive: true });

    if (categories.length === 0) {
      await ctx.editMessageText('❌ No FAQ categories available at the moment.');
      return;
    }

    // Build keyboard with categories
    const keyboard = new InlineKeyboard();
    
    categories.sort().forEach(category => {
      keyboard.text(`📁 ${category}`, `faq:category:${category}`).row();
    });

    await ctx.editMessageText(
      '📚 *Frequently Asked Questions*\n\n' +
      'Please select a category:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  } catch (error) {
    console.error('Error showing categories:', error);
    await ctx.editMessageText('❌ Error loading categories. Please try again.');
  }
}

/**
 * Shows questions in a specific category
 */
async function showCategoryQuestions(ctx: BotContext, category: string): Promise<void> {
  await ctx.answerCallbackQuery();

  try {
    const faqs = await FAQ.find({ 
      category,
      isActive: true 
    }).sort({ order: 1 }).limit(20);

    if (faqs.length === 0) {
      await ctx.editMessageText(
        `❌ No questions found in category "${category}".`,
        {
          reply_markup: new InlineKeyboard()
            .text('⬅️ Back to Categories', 'faq:back:categories')
        }
      );
      return;
    }

    // Build keyboard with questions
    const keyboard = new InlineKeyboard();
    
    faqs.forEach(faq => {
      // Truncate long questions for display
      const displayText = faq.question.length > 60
        ? faq.question.substring(0, 57) + '...'
        : faq.question;
      
      keyboard.text(`${displayText}`, `faq:question:${faq._id}`).row();
    });

    // Add back button
    keyboard.text('⬅️ Back to Categories', 'faq:back:categories');

    await ctx.editMessageText(
      `📁 *${category}*\n\n` +
      'Select a question:',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    console.log(`📚 Category "${category}" opened by user ${ctx.from?.id}`);

  } catch (error) {
    console.error('Error showing category questions:', error);
    await ctx.editMessageText('❌ Error loading questions. Please try again.');
  }
}

/**
 * Shows answer to a specific question
 */
async function showQuestionAnswer(ctx: BotContext, faqId: string): Promise<void> {
  await ctx.answerCallbackQuery();

  try {
    const faq = await FAQ.findById(faqId);

    if (!faq || !faq.isActive) {
      await ctx.editMessageText(
        '❌ FAQ not found or no longer available.',
        {
          reply_markup: new InlineKeyboard()
            .text('⬅️ Back to Categories', 'faq:back:categories')
        }
      );
      return;
    }

    const config = loadConfig();
    const username = escapeMarkdown(config.bot.username)

    // Build keyboard with back buttons
    const keyboard = new InlineKeyboard()
      .text(`⬅️ Back to ${faq.category}`, `faq:category:${faq.category}`)
      .row()
      .text('📚 All Categories', 'faq:back:categories');

    await ctx.editMessageText(
      `*${faq.question}*\n\n` +
      `${faq.answer}\n\n` +
      `─────────────────\n` +
      `💡 *Need more help?*\n` +
      `Send @${username} a direct message to create a support ticket!`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    console.log(`📚 FAQ answered: "${faq.question}" for user ${ctx.from?.id}`);

  } catch (error) {
    console.error('Error showing question answer:', error);
    await ctx.editMessageText('❌ Error loading answer. Please try again.');
  }
}