import { Bot } from 'grammy';
import { BotContext } from './types';
import { loadConfig } from './config/loader';
import { connectDatabase } from './database/connection';
import { logger } from './middleware/logger';
import { validateConfiguration } from './utils/validateConfig';

// Command handlers
import { handleStart } from './handlers/commands/start';
import { handleHelp } from './handlers/commands/help';
import { handleId } from './handlers/commands/id';

// FAQ handlers
import { showFAQMenu } from './handlers/faq/menu';
import { handleFAQCallback } from './handlers/faq/callback';

// Message handlers (NEW)
import { handleUserMessage } from './handlers/messages/userMessage';
import { handleTechnicianMessage } from './handlers/messages/technicianMessage';

// Ticket management
import { showUserTickets } from './handlers/tickets/list';

// Technician handlers
import { listOpenTickets } from './handlers/technician/list';
import { closeTicket } from './handlers/technician/close';

// Background jobs
import { startTopicCleanupJob } from './jobs/topicCleanup';

async function main() {
  console.log('🤖 Starting Telegram Support Bot v3 (Forum Topics Edition)...\n');

  // ===== Load Configuration =====
  const config = loadConfig();
  console.log('✅ Configuration loaded');

  // ===== Connect to Database =====
  await connectDatabase(config.database.uri);

  // ===== Initialize Bot =====
  const bot = new Bot<BotContext>(config.bot.token);
  console.log('✅ Bot initialized');

  // ===== Validate Configuration =====
  await validateConfiguration(bot.api, config);

  // ===== Middleware =====
  bot.use(logger);

  // =========================================================================
  // BASIC COMMANDS
  // =========================================================================

  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('id', handleId);

  // =========================================================================
  // FAQ SYSTEM (Works everywhere)
  // =========================================================================

  bot.command('faq', showFAQMenu);
  bot.callbackQuery(/^faq:/, handleFAQCallback);

  // =========================================================================
  // USER TICKET MANAGEMENT (Private DM only)
  // =========================================================================

  bot.command('mytickets', async (ctx) => {
    if (ctx.chat?.type === 'private') {
      await showUserTickets(ctx);
    }
  });
  
  // Note: /cancel command removed - no longer needed in stateless design

  // =========================================================================
  // TECHNICIAN COMMANDS (Tech group only)
  // =========================================================================

  bot.command('open', listOpenTickets);
  bot.command('close', closeTicket);

  // =========================================================================
  // MESSAGE ROUTING (The Core Logic!)
  // =========================================================================

  bot.on('message', async (ctx) => {
    // Process technician messages first (more specific)
    await handleTechnicianMessage(ctx);
    
    // Then process user messages (fallback)
    await handleUserMessage(ctx);
  });

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  bot.catch((err) => {
    console.error(`❌ Error handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
  });

  // =========================================================================
  // START BOT
  // =========================================================================

  await bot.start({
    onStart: (botInfo) => {
      console.log('\n✅ Bot is running!');
      console.log(`📱 Username: @${botInfo.username}`);
      console.log(`🏢 Tech Group: ${config.groups.technician_group_id}`);
      console.log(`📋 General Topic: ${config.topics.general_topic_id}`);
      console.log(`\n💡 Users can now DM the bot directly to create tickets!\n`);
    }
  });

  // =========================================================================
  // START BACKGROUND JOBS
  // =========================================================================

  startTopicCleanupJob(bot);
  console.log('✅ Background cleanup job started');

  // =========================================================================
  // GRACEFUL SHUTDOWN
  // =========================================================================

  const shutdown = async (signal: string) => {
    console.log(`\n⏹️  Received ${signal}, shutting down...`);
    await bot.stop();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

// ===== Run Bot =====
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});