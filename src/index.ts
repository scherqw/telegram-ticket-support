import { Bot, session } from 'grammy';
import { BotContext, SessionData } from './types';
import { loadConfig } from './config/loader';
import { connectDatabase } from './database/connection';
import { logger } from './middleware/logger';
import { privateOnly } from './middleware/privateOnly';

// Command handlers
import { handleStart } from './handlers/commands/start';
import { handleHelp } from './handlers/commands/help';
import { handleId } from './handlers/commands/id';

// FAQ handlers
import { showFAQMenu } from './handlers/faq/menu';
import { handleFAQCallback, handleFAQSolved } from './handlers/faq/callback';

// Ticket handlers
import {
  startTicketCreation,
  handleTicketMessage,
  cancelTicketCreation
} from './handlers/tickets/create';
import { showUserTickets } from './handlers/tickets/list';

// Technician handlers
import { handleTechnicianReply } from './handlers/technician/reply';
import { listOpenTickets } from './handlers/technician/list';
import { closeTicket } from './handlers/technician/close';
import { reopenTicket } from './handlers/technician/reopen';

async function main() {
  console.log('🤖 Starting Telegram Support Bot v2...\n');

  // Load configuration
  const config = loadConfig();
  console.log('✅ Configuration loaded');

  // Connect to database
  await connectDatabase(config.database.uri);

  // Initialize bot
  const bot = new Bot<BotContext>(config.bot.token);
  console.log('✅ Bot initialized');

  // Session middleware
  bot.use(session({
    initial: (): SessionData => ({
      awaitingTicket: false,
      currentTicketId: undefined
    })
  }));

  // Logging middleware
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
  bot.callbackQuery('faq_solved', handleFAQSolved);
  bot.callbackQuery('create_ticket', privateOnly, startTicketCreation);

  // =========================================================================
  // TICKET SYSTEM (Private DM only)
  // =========================================================================

  bot.command('ticket', privateOnly, startTicketCreation);
  bot.command('mytickets', privateOnly, showUserTickets);
  bot.command('cancel', privateOnly, cancelTicketCreation);

  // =========================================================================
  // TECHNICIAN COMMANDS (Staff group)
  // =========================================================================

  bot.command('open', listOpenTickets);
  bot.command('close', closeTicket);
  bot.command('reopen', reopenTicket);

  // =========================================================================
  // MESSAGE HANDLERS
  // =========================================================================

  bot.on('message', async (ctx) => {
    // Handle technician replies
    await handleTechnicianReply(ctx);
    
    // Handle ticket creation
    await handleTicketMessage(ctx);
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
      console.log(`\n💡 Send /start to your bot to begin!\n`);
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

// Run bot
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});