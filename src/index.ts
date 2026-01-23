import { Bot } from 'grammy';
import { BotContext } from './types';
import { loadConfig } from './config/loader';
import { connectDatabase } from './database/connection';
import { logger } from './middleware/logger';
import { ensureBucketExists } from './services/s3Service';
import { createApp } from './server/app';
import { setBotInstance as setMessageControllerBot } from './server/controllers/messageController';
import { setBotInstance as setMediaControllerBot } from './server/controllers/mediaController';

// Command handlers
import { handleStart } from './handlers/commands/start';
import { handleHelp } from './handlers/commands/help';

// FAQ handlers
import { showFAQMenu } from './handlers/faq/menu';
import { handleFAQCallback } from './handlers/faq/callback';

// Rating handlers
import { handleRatingCallback } from './handlers/rating/ratingHandler';

// Message handlers
import { handleUserMessage } from './handlers/messages/userMessage';

// Ticket management
import { showUserTickets } from './handlers/tickets/list';

export const config = loadConfig();
export const bot = new Bot<BotContext>(config.bot.token);

async function main() {
  console.log('🤖 Starting Telegram Support Bot (Web App Edition)...\n');

  // ===== Load Configuration =====
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
  console.log('✅ Bot initialized');

  // Set bot instances for controllers
  setMessageControllerBot(bot);
  setMediaControllerBot(bot);

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
  // USER TICKET MANAGEMENT (Private DM only)
  // =========================================================================

  bot.command('mytickets', async (ctx) => {
    if (ctx.chat?.type === 'private') {
      await showUserTickets(ctx);
    }
  });

  // =========================================================================
  // MESSAGE ROUTING (Users only - no technician group logic)
  // =========================================================================

  bot.on('message', async (ctx) => {
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
  // START EXPRESS SERVER
  // =========================================================================

  const app = createApp();
  const server = app.listen(config.webapp.port, () => {
    console.log(`🌐 Web App server running on port ${config.webapp.port}`);
  });

  // =========================================================================
  // START BOT
  // =========================================================================

  await bot.start({
    onStart: (botInfo) => {
      console.log('\n✅ Bot is running!');
      console.log(`📱 Username: @${botInfo.username}`);
      console.log(`🌐 Web App URL: ${config.webapp.url}`);
      console.log(`📦 S3 Storage: ${process.env.S3_ENDPOINT || 'http://localstack:4566'}`);
      console.log(`\n💡 Technicians can access the dashboard via menu button`);
      console.log(`💡 Users can send messages to create tickets\n`);
    }
  });

  // =========================================================================
  // GRACEFUL SHUTDOWN
  // =========================================================================

  const shutdown = async (signal: string) => {
    console.log(`\n⏹️  Received ${signal}, shutting down...`);
    server.close();
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
