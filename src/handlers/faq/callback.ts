import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../types';
import { FAQ } from '../../database/models/FAQ';
import { isPrivateChat } from '../../utils/chatContext';

/**
 * Handles FAQ button clicks
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

    await ctx.reply(
      `*${faq.question}*\n\n${faq.answer}`,
      { parse_mode: 'Markdown' }
    );

    // Offer ticket creation in private chat
    if (isPrivateChat(ctx)) {
      const keyboard = new InlineKeyboard()
        .text('✅ Solved', 'faq_solved')
        .text('📝 Create Ticket', 'create_ticket');

      await ctx.reply(
        'Did this answer your question?',
        { reply_markup: keyboard }
      );
    }
  } catch (error) {
    console.error('Error handling FAQ callback:', error);
    await ctx.answerCallbackQuery('❌ Error loading FAQ');
  }
}

/**
 * Handles FAQ resolved callback
 */
export async function handleFAQSolved(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery('✅ Great!');
  await ctx.reply('✅ Glad I could help! Use /faq anytime.');
}
