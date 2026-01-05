import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../types';
import { Ticket } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';

/**
 * Shows category selection inline keyboard to technician
 * 
 * @param ctx - Bot context
 * @param ticketId - Ticket ID to categorize
 */
export async function showCategorySelection(
  ctx: BotContext,
  ticketId: string
): Promise<void> {
  const config = loadConfig();

  if (!config.features.enable_categorization) {
    console.log('⚠️  Categorization is disabled in config');
    return;
  }

  if (!config.categories || config.categories.length === 0) {
    console.log('⚠️  No categories configured');
    return;
  }

  try {
    // Find the ticket
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      await ctx.reply('❌ Ticket not found.', {
        message_thread_id: ctx.message?.message_thread_id
      });
      return;
    }

    // Build category keyboard
    const keyboard = buildCategoryKeyboard(config.categories, ticket.categories || [], ticketId);

    await ctx.reply(
      '🏷️ *Categorize Ticket*\n\n' +
      `Ticket: ${ticketId}\n` +
      'Select one or more categories that apply:\n\n' +
      (ticket.categories && ticket.categories.length > 0
        ? `Current: ${ticket.categories.map(c => getCategoryLabel(c, config.categories)).join(', ')}\n\n`
        : '') +
      'Click "✅ Done" when finished.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        message_thread_id: ctx.message?.message_thread_id
      }
    );

  } catch (error) {
    console.error('Error showing category selection:', error);
    await ctx.reply('❌ Error loading categories.', {
      message_thread_id: ctx.message?.message_thread_id
    });
  }
}

/**
 * Handles category selection callback
 */
export async function handleCategoryCallback(ctx: BotContext): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData || !callbackData.startsWith('cat:')) {
    await ctx.answerCallbackQuery('❌ Invalid selection');
    return;
  }

  const config = loadConfig();

  // Parse: cat:TICK-0001:account or cat:TICK-0001:done
  const parts = callbackData.split(':');
  const ticketId = parts[1];
  const action = parts[2];

  try {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      await ctx.answerCallbackQuery('❌ Ticket not found');
      return;
    }

    // Handle "Done" action
    if (action === 'done') {
      if (!ticket.categories || ticket.categories.length === 0) {
        await ctx.answerCallbackQuery('⚠️ Please select at least one category');
        return;
      }

      // Finalize categorization
      ticket.categorizedBy = ctx.from?.id;
      ticket.categorizedAt = new Date();
      await ticket.save();

      const categoryLabels = ticket.categories
        .map(c => getCategoryLabel(c, config.categories))
        .join(', ');

      await ctx.answerCallbackQuery('✅ Categorized');
      await ctx.editMessageText(
        `✅ *Ticket Categorized*\n\n` +
        `Ticket: ${ticketId}\n` +
        `Categories: ${categoryLabels}\n\n` +
        `Closing ticket now...`,
        { parse_mode: 'Markdown' }
      );

      console.log(`🏷️  Ticket ${ticketId} categorized as: ${ticket.categories.join(', ')}`);

      // ===== FIX: Import and call finalizeTicketClosure =====
      const { finalizeTicketClosure } = await import('../technician/close');
      await finalizeTicketClosure(ctx, ticket, config);

      return;
    }

    // Toggle category
    const categoryId = action;

    if (!ticket.categories) {
      ticket.categories = [];
    }

    const index = ticket.categories.indexOf(categoryId);
    if (index > -1) {
      // Remove category
      ticket.categories.splice(index, 1);
      await ctx.answerCallbackQuery(`Removed ${getCategoryLabel(categoryId, config.categories)}`);
    } else {
      // Add category
      ticket.categories.push(categoryId);
      await ctx.answerCallbackQuery(`Added ${getCategoryLabel(categoryId, config.categories)}`);
    }

    await ticket.save();

    // Update keyboard to show new selection
    const keyboard = buildCategoryKeyboard(config.categories, ticket.categories, ticketId);

    await ctx.editMessageText(
      '🏷️ *Categorize Ticket*\n\n' +
      `Ticket: ${ticketId}\n` +
      'Select one or more categories that apply:\n\n' +
      (ticket.categories.length > 0
        ? `Current: ${ticket.categories.map(c => getCategoryLabel(c, config.categories)).join(', ')}\n\n`
        : 'No categories selected yet.\n\n') +
      'Click "✅ Done" when finished.',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

  } catch (error) {
    console.error('Error handling category callback:', error);
    await ctx.answerCallbackQuery('❌ Error updating category');
  }
}

/**
 * Builds category selection keyboard
 */
function buildCategoryKeyboard(
  availableCategories: any[],
  selectedCategories: string[],
  ticketId: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Add category buttons (2 per row for better UX)
  availableCategories.forEach((category, index) => {
    const isSelected = selectedCategories.includes(category.id);
    const label = isSelected ? `✓ ${category.label}` : category.label;

    keyboard.text(label, `cat:${ticketId}:${category.id}`);

    // New row after every 2 buttons
    if (index % 2 === 1) {
      keyboard.row();
    }
  });

  // Add done button on its own row
  if (availableCategories.length % 2 === 1) {
    keyboard.row();
  }
  keyboard.text('✅ Done Categorizing', `cat:${ticketId}:done`);

  return keyboard;
}

/**
 * Gets category label from ID
 */
function getCategoryLabel(categoryId: string, categories: any[]): string {
  const category = categories.find(c => c.id === categoryId);
  return category ? category.label : categoryId;
}

/**
 * Validates if ticket has been categorized
 */
export function isTicketCategorized(ticket: any): boolean {
  return ticket.categories && ticket.categories.length > 0;
}