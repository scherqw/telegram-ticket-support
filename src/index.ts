import { Bot } from 'grammy';
import { BotContext } from './types';
import { loadConfig } from './config/loader';
import { connectDatabase } from './database/connection';
import { logger } from './middleware/logger';
import { validateConfiguration } from './utils/validateConfig';
import { ensureBucketExists } from './services/s3Service';

// Command handlers
import { handleStart } from './handlers/commands/start';
import { handleHelp } from './handlers/commands/help';

// FAQ handlers
import { showFAQMenu } from './handlers/faq/menu';
import { handleFAQCallback } from './handlers/faq/callback';

// Rating handlers
import { handleRatingCallback } from './handlers/rating/ratingHandler';

// Categorization handlers
import { handleCategoryCallback } from './handlers/categorization/categoryHandler';

// Message handlers
import { handleUserMessage } from './handlers/messages/userMessage';
import { handleTechnicianMessage } from './handlers/messages/technicianMessage';

// Ticket management
import { showUserTickets } from './handlers/tickets/list';

// Technician handlers
import { listOpenTickets } from './handlers/technician/list';
import { closeTicket } from './handlers/technician/close';

async function main() {
  console.log('🤖 Starting Telegram Support Bot v3 (Forum Topics + S3 Edition)...\n');

  // ===== Load Configuration =====
  const config = loadConfig();
  console.log('✅ Configuration loaded');

  // ===== Connect to Database =====
  await connectDatabase(config.database.uri);

  // ===== Initialize S3 Bucket =====
  try {
    await ensureBucketExists();
    console.log('✅ S3 storage initialized');
  } catch (error) {
    console.error('❌ Failed to initialize S3:', error);
    console.error('⚠️  Bot will continue but media upload will fail');
  }

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

  // =========================================================================
  // FAQ SYSTEM (Works everywhere)
  // =========================================================================

  bot.command('faq', showFAQMenu);
  bot.callbackQuery(/^faq:/, handleFAQCallback);

  // =========================================================================
  // RATING SYSTEM
  // =========================================================================

  bot.callbackQuery(/^rate:/, handleRatingCallback);

  // =========================================================================
  // CATEGORIZATION SYSTEM
  // =========================================================================

  bot.callbackQuery(/^cat:/, handleCategoryCallback);

  // =========================================================================
  // USER TICKET MANAGEMENT (Private DM only)
  // =========================================================================

  bot.command('mytickets', async (ctx) => {
    if (ctx.chat?.type === 'private') {
      await showUserTickets(ctx);
    }
  });

  // =========================================================================
  // TECHNICIAN COMMANDS (Tech group only)
  // =========================================================================

  bot.command('open', listOpenTickets);
  bot.command('close', closeTicket);

  // =========================================================================
  // MESSAGE ROUTING (The Core Logic!)
  // =========================================================================

  bot.on('message', async (ctx) => {
    await handleTechnicianMessage(ctx);
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
      console.log(`📦 S3 Storage: ${process.env.S3_ENDPOINT || 'http://localstack:4566'}`);
      console.log(`\n💡 Users can now DM the bot directly to create tickets!\n`);
      console.log(`📎 Media files will be stored in S3 and referenced in MongoDB\n`);
    }
  });

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