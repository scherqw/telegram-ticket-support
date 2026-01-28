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
import { handleLinkCommand } from './handlers/commands/linkTechnician';

// FAQ handlers
import { showFAQMenu } from './handlers/faq/menu';
import { handleFAQCallback } from './handlers/faq/callback';

// Rating handlers
import { handleRatingCallback } from './handlers/rating/ratingHandler';

// Message handlers
import { handleUserMessage, setTechBot as setNotificationBot } from './handlers/messages/userMessage';

// Ticket management
import { showUserTickets } from './handlers/tickets/list';

export const config = loadConfig();
export const userBot = new Bot<BotContext>(config.bot.user_token);
export const techBot = new Bot<BotContext>(config.bot.tech_token);

async function main() {
  console.log('🤖 Starting Telegram Support Bot...\n');

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
  setMessageControllerBot(userBot);
  setMediaControllerBot(userBot);
  setNotificationBot(techBot);

  // ===== Middleware =====
  userBot.use(logger);

  // =========================================================================
  // BASIC COMMANDS
  // =========================================================================

  userBot.command('start', handleStart);
  userBot.command('help', handleHelp);

  // =========================================================================
  // FAQ SYSTEM (Works everywhere)
  // =========================================================================

  userBot.command('faq', showFAQMenu);
  userBot.callbackQuery(/^faq:/, handleFAQCallback);

  // =========================================================================
  // RATING SYSTEM
  // =========================================================================

  userBot.callbackQuery(/^rate:/, handleRatingCallback);

  // =========================================================================
  // USER TICKET MANAGEMENT (Private DM only)
  // =========================================================================

  userBot.command('mytickets', async (ctx) => {
    if (ctx.chat?.type === 'private') {
      await showUserTickets(ctx);
    }
  });

  // =========================================================================
  // MESSAGE ROUTING (Users only - no technician group logic)
  // =========================================================================

  userBot.on('message', async (ctx) => {
    await handleUserMessage(ctx);
  });

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  userBot.catch((err) => {
    console.error(`❌ Error handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
  });

  // =========================================================================
  // TECH BOT CONFIGURATION
  // =========================================================================

  techBot.use(logger);

  techBot.command('link', handleLinkCommand);

  techBot.command('start', async (ctx) => {
    await ctx.reply('👋 Hello! Use /link <code> to log in to the dashboard.');
  });

  techBot.catch((err) => {
    console.error(`❌ Tech Bot Error ${err.ctx.update.update_id}:`, err.error);
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
  await Promise.all([
    userBot.start({
      onStart: (botInfo) => {
        console.log('\n✅ User Bot is running!');
        console.log(`📱 Username: @${botInfo.username}`);
        console.log(`🌐 Web App URL: ${config.webapp.url}`);
        console.log(`📦 S3 Storage: ${process.env.S3_ENDPOINT || 'http://localstack:4566'}`);
        console.log(`💡 Users can send messages to create tickets\n`);
      }
    }),

    techBot.start({
      onStart: (botInfo) => {
        console.log(`✅ Tech Bot is running! (@${botInfo.username})`)
      }
    })
  ]);

  // =========================================================================
  // GRACEFUL SHUTDOWN
  // =========================================================================

  const shutdown = async (signal: string) => {
    console.log(`\n⏹️  Received ${signal}, shutting down...`);
    server.close();
    await Promise.all([
      userBot.stop(),
      techBot.stop()
    ])
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
