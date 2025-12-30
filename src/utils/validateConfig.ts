import { Api } from 'grammy';
import { BotConfig } from '../types';

/**
 * Validates bot configuration and group setup
 */
export async function validateConfiguration(
  api: Api,
  config: BotConfig
): Promise<void> {
  console.log('🔍 Validating configuration...');

  try {
    // Check if tech group exists and bot is member
    const chat = await api.getChat(config.groups.technician_group_id);

    // Check if it's a supergroup
    if (chat.type !== 'supergroup') {
      console.error('❌ CONFIGURATION ERROR:');
      console.error('   The technician group must be a supergroup.');
      console.error('   Current type:', chat.type);
      console.error('\n   How to fix:');
      console.error('   1. Open the group in Telegram');
      console.error('   2. Convert it to a supergroup');
      process.exit(1);
    }

    // Check if Topics are enabled
    if (!chat.is_forum) {
      console.error('❌ CONFIGURATION ERROR:');
      console.error('   Topics are NOT enabled in the technician group!');
      console.error('\n   How to fix:');
      console.error('   1. Open the group in Telegram');
      console.error('   2. Go to Group Settings');
      console.error('   3. Enable "Topics"');
      console.error('   4. Restart the bot');
      console.error('\n   Group ID:', config.groups.technician_group_id);
      console.error('   Group title:', chat.title);
      process.exit(1);
    }

    // Check bot permissions
    const botMember = await api.getChatMember(
      config.groups.technician_group_id,
      (await api.getMe()).id
    );

    if (botMember.status !== 'administrator') {
      console.warn('⚠️  WARNING:');
      console.warn('   Bot is not an administrator in the tech group.');
      console.warn('   Some features may not work properly.');
      console.warn('   Please make the bot an admin with these permissions:');
      console.warn('   - Delete messages');
      console.warn('   - Manage topics');
      console.warn('   - Post messages');
    }

    console.log('✅ Configuration validated successfully');
    console.log(`   Group: "${chat.title}"`);
    console.log(`   Topics enabled: Yes`);
    console.log(`   Bot status: ${botMember.status}`);

  } catch (error: any) {
    console.error('❌ VALIDATION ERROR:');
    
    if (error.description?.includes('chat not found')) {
      console.error('   Cannot find the technician group.');
      console.error('   Group ID:', config.groups.technician_group_id);
      console.error('\n   How to fix:');
      console.error('   1. Add the bot to your tech group');
      console.error('   2. Make sure the group ID is correct');
      console.error('   3. Use /id command in the group to get the correct ID');
    } else if (error.description?.includes('bot is not a member')) {
      console.error('   Bot is not a member of the technician group.');
      console.error('   Group ID:', config.groups.technician_group_id);
      console.error('\n   How to fix:');
      console.error('   1. Add the bot to your tech group');
      console.error('   2. Make the bot an administrator');
    } else {
      console.error('   Unexpected error:', error.message);
    }
    
    process.exit(1);
  }
}