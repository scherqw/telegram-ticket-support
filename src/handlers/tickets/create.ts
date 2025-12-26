// import { BotContext } from '../../types';
// import { Ticket, TicketStatus } from '../../database/models/Ticket';
// import { isPrivateChat } from '../../utils/chatContext';
// import { loadConfig } from '../../config/loader';

// /**
//  * Starts ticket creation process
//  */
// export async function startTicketCreation(ctx: BotContext): Promise<void> {
//   if (!isPrivateChat(ctx)) return;

//   await ctx.reply(
//     '📝 *Create Support Ticket*\n\n' +
//     'Please describe your issue. You can send:\n' +
//     '• Text messages\n' +
//     '• Photos\n' +
//     '• Documents\n' +
//     '• Voice messages\n\n' +
//     'Type /cancel to cancel.',
//     { parse_mode: 'Markdown' }
//   );

//   if (!ctx.session) ctx.session = {};
//   ctx.session.awaitingTicket = true;
// }

// /**
//  * Handles ticket message submission
//  */
// export async function handleTicketMessage(ctx: BotContext): Promise<void> {
//   if (!ctx.session?.awaitingTicket) return;
//   if (!ctx.message || !ctx.from) return;

//   const config = loadConfig();
//   const userId = ctx.from.id;
//   const username = ctx.from.username;
//   const firstName = ctx.from.first_name;
//   const lastName = ctx.from.last_name;

//   try {
//     // Extract message content
//     let messageText = '';
//     let messageType = 'text';

//     if ('text' in ctx.message && ctx.message.text) {
//       messageText = ctx.message.text;
//     } else if ('caption' in ctx.message && ctx.message.caption) {
//       messageText = ctx.message.caption;
//       messageType = 'media with caption';
//     } else if ('photo' in ctx.message) {
//       messageText = '[Photo]';
//       messageType = 'photo';
//     } else if ('document' in ctx.message) {
//       messageText = '[Document]';
//       messageType = 'document';
//     } else if ('voice' in ctx.message) {
//       messageText = '[Voice message]';
//       messageType = 'voice';
//     } else {
//       messageText = '[Media]';
//       messageType = 'media';
//     }

//     const subject = messageText.length > 100
//       ? messageText.substring(0, 97) + '...'
//       : messageText;

//     // Create ticket
//     const ticket = new Ticket({
//       userId,
//       username,
//       firstName,
//       lastName,
//       subject,
//       userMessageId: ctx.message.message_id,
//       status: TicketStatus.OPEN,
//       messages: [{
//         from: 'user',
//         text: messageText,
//         timestamp: new Date(),
//         messageId: ctx.message.message_id
//       }]
//     });

//     await ticket.save();

//     // Format tech message
//     const techMessage =
//       `🎫 *New Ticket: ${ticket.ticketId}*\n\n` +
//       `👤 *User:* ${firstName}${lastName ? ' ' + lastName : ''}` +
//       `${username ? ` (@${username})` : ''}\n` +
//       `🆔 *User ID:* \`${userId}\`\n` +
//       `📝 *Type:* ${messageType}\n` +
//       `⏰ *Time:* ${new Date().toLocaleString()}\n\n` +
//       `*Message:*\n${messageText}\n\n` +
//       `💬 _Reply to this message to respond._`;

//     // Send to tech group
//     const forwardedMsg = await ctx.api.sendMessage(
//       config.groups.technician_group_id,
//       techMessage,
//       { parse_mode: 'Markdown' }
//     );

//     // Forward media if present
//     if (messageType !== 'text') {
//       await ctx.api.copyMessage(
//         config.groups.technician_group_id,
//         ctx.chat!.id,
//         ctx.message.message_id
//       );
//     }

//     // Update ticket with tech message ID
//     ticket.techGroupMessageId = forwardedMsg.message_id;
//     await ticket.save();

//     // Confirm to user
//     await ctx.reply(
//       `✅ *Ticket Created: ${ticket.ticketId}*\n\n` +
//       'Your request has been received. Our team will respond shortly.',
//       { parse_mode: 'Markdown' }
//     );

//     // Reset session
//     ctx.session.awaitingTicket = false;
//     ctx.session.currentTicketId = ticket.ticketId;

//   } catch (error) {
//     console.error('Error creating ticket:', error);
//     await ctx.reply('❌ Failed to create ticket. Please try again.');
//   }
// }

// /**
//  * Cancels ticket creation
//  */
// export async function cancelTicketCreation(ctx: BotContext): Promise<void> {
//   if (ctx.session?.awaitingTicket) {
//     ctx.session.awaitingTicket = false;
//     await ctx.reply('❌ Ticket creation cancelled.');
//   } else {
//     await ctx.reply('ℹ️ No active ticket creation.');
//   }
// }

import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { isPrivateChat } from '../../utils/chatContext';
import { loadConfig } from '../../config/loader';

/**
 * Starts ticket creation process
 */
export async function startTicketCreation(ctx: BotContext): Promise<void> {
  if (!isPrivateChat(ctx)) return;

  // Check if user already has an open ticket
  const activeTicket = await Ticket.findOne({
    userId: ctx.from?.id,
    status: { $ne: TicketStatus.CLOSED }
  });

  if (activeTicket) {
    await ctx.reply(
      `⚠️ You already have an open ticket (*${activeTicket.ticketId}*).\n` +
      `Please simply reply to this message to add more details, or use /close to close it.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.reply(
    '📝 *Create Support Ticket*\n\n' +
    'Please describe your issue. You can send:\n' +
    '• Text messages\n' +
    '• Photos\n' +
    '• Documents\n' +
    '• Voice messages\n\n' +
    'Type /cancel to cancel.',
    { parse_mode: 'Markdown' }
  );

  ctx.session.awaitingTicket = true;
}

/**
 * Handles ticket messages (Creation AND Replies)
 */
export async function handleTicketMessage(ctx: BotContext): Promise<void> {
  if (!isPrivateChat(ctx)) return;
  if (!ctx.message || !ctx.from) return;

  // 1. If NOT creating a ticket, check if it's a reply to an existing active ticket
  if (!ctx.session?.awaitingTicket) {
    await handleUserReply(ctx);
    return;
  }

  // 2. Logic for CREATING a new ticket (existing logic)
  const config = loadConfig();
  const userId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name;

  try {
    let messageText = '';
    let messageType = 'text';

    // Safely extract text/caption
    if ('text' in ctx.message && ctx.message.text) {
      messageText = ctx.message.text;
    } else if ('caption' in ctx.message && ctx.message.caption) {
      messageText = ctx.message.caption;
      messageType = 'media with caption';
    } else {
      messageText = '[Media Message]';
      messageType = 'media';
    }

    const subject = messageText.length > 100
      ? messageText.substring(0, 97) + '...'
      : messageText;

    const ticket = new Ticket({
      userId,
      username,
      firstName,
      lastName,
      subject,
      userMessageId: ctx.message.message_id,
      status: TicketStatus.OPEN,
      messages: [{
        from: 'user',
        text: messageText,
        timestamp: new Date(),
        messageId: ctx.message.message_id
      }]
    });

    await ticket.save();

    // Notify Technicians
    const techMessage =
      `🎫 *New Ticket: ${ticket.ticketId}*\n\n` +
      `👤 *User:* ${firstName}${lastName ? ' ' + lastName : ''}` +
      `${username ? ` (@${username})` : ''}\n` +
      `🆔 *User ID:* \`${userId}\`\n` +
      `📝 *Type:* ${messageType}\n` +
      `⏰ *Time:* ${new Date().toLocaleString()}\n\n` +
      `*Message:*\n${messageText}\n\n` +
      `💬 _Reply to this message to respond._`;

    const forwardedMsg = await ctx.api.sendMessage(
      config.groups.technician_group_id,
      techMessage,
      { parse_mode: 'Markdown' }
    );

    // Forward media if needed
    if (!('text' in ctx.message)) {
       await ctx.api.copyMessage(
        config.groups.technician_group_id,
        ctx.chat!.id,
        ctx.message.message_id
      );
    }

    ticket.techGroupMessageId = forwardedMsg.message_id;
    await ticket.save();

    await ctx.reply(
      `✅ *Ticket Created: ${ticket.ticketId}*\n\n` +
      'Your request has been received. You can reply to this chat to add more info.\n' +
      'Use /close to close this ticket when resolved.',
      { parse_mode: 'Markdown' }
    );

    ctx.session.awaitingTicket = false;
    ctx.session.currentTicketId = ticket.ticketId;

  } catch (error) {
    console.error('Error creating ticket:', error);
    await ctx.reply('❌ Failed to create ticket. Please try again.');
  }
}

/**
 * HELPER: Handles user replies to active tickets
 */
async function handleUserReply(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  const userId = ctx.from?.id;

  try {
    // Find active ticket for this user
    const ticket = await Ticket.findOne({
      userId,
      status: { $ne: TicketStatus.CLOSED }
    });

    // If no active ticket, ignore (allow other commands to work)
    if (!ticket || !ticket.techGroupMessageId) return;

    // Extract message content safely
    let messageText = '';
    if ('text' in ctx.message! && ctx.message!.text) {
      messageText = ctx.message!.text;
    } else if ('caption' in ctx.message! && ctx.message!.caption) {
      messageText = ctx.message!.caption;
    } else {
      messageText = '[Media Message]';
    }

    // Forward user's reply to the Technician Group (threaded reply)
    const forwardedMsg = await ctx.api.copyMessage(
      config.groups.technician_group_id,
      ctx.chat!.id,
      ctx.message!.message_id,
      {
        reply_to_message_id: ticket.techGroupMessageId // Threads it to the original ticket
      }
    );

    // Save to DB
    ticket.messages.push({
      from: 'user',
      text: messageText,
      timestamp: new Date(),
      messageId: ctx.message!.message_id,
      groupMessageId: forwardedMsg.message_id,
    });
    
    // Update status to Open if it was In Progress (optional, alerts techs there is new activity)
    if (ticket.status === TicketStatus.IN_PROGRESS) {
        ticket.status = TicketStatus.OPEN;
    }

    await ticket.save();
    
    // Optional: Log success
    // console.log(`User reply forwarded for ticket ${ticket.ticketId}`);

  } catch (error) {
    console.error('Error forwarding user reply:', error);
    await ctx.reply('❌ Failed to send message to support.');
  }
}

/**
 * Cancels ticket creation
 */
export async function cancelTicketCreation(ctx: BotContext): Promise<void> {
  if (ctx.session?.awaitingTicket) {
    ctx.session.awaitingTicket = false;
    await ctx.reply('❌ Ticket creation cancelled.');
  } else {
    await ctx.reply('ℹ️ No active ticket creation.');
  }
}