// import { BotContext } from '../../types';
// import { Ticket, TicketStatus } from '../../database/models/Ticket';
// import { isTechnicianGroup } from '../../utils/chatContext';
// import { loadConfig } from '../../config/loader';

// /**
//  * Handles technician replies to tickets
//  */
// export async function handleTechnicianReply(ctx: BotContext): Promise<void> {
//   const config = loadConfig();
  
//   if (!isTechnicianGroup(ctx, config.groups.technician_group_id)) {
//     return;
//   }

//   if (!ctx.message || !('reply_to_message' in ctx.message) || !ctx.message.reply_to_message) {
//     return;
//   }

//   const replyToMessageId = ctx.message.reply_to_message.message_id;

//   try {
//     const ticket = await Ticket.findOne({
//       techGroupMessageId: replyToMessageId,
//       status: { $ne: TicketStatus.CLOSED },
//       $or: [
//         { techGroupMessageId: replyToMessageId },
//         { 'messages.groupMessageId': replyToMessageId },
//         { 'messages.messageId': replyToMessageId, 'messages.from': 'technician' }
//       ]
//     });

//     if (!ticket) return;

//     // Extract reply
//     let replyText = '';
//     if ('text' in ctx.message && ctx.message.text) {
//       replyText = ctx.message.text;
//     } else if ('caption' in ctx.message && ctx.message.caption) {
//       replyText = ctx.message.caption;
//     } else {
//       replyText = '[Support sent a media response]';
//     }

//     const technicianId = ctx.from?.id;
//     const technicianName = ctx.from?.first_name || 'Support';

//     // Send to user
//     await ctx.api.sendMessage(
//       ticket.userId,
//       `💬 *Support Response* (${ticket.ticketId})\n\n` +
//       `From: ${technicianName}\n\n` +
//       `${replyText}`,
//       { parse_mode: 'Markdown' }
//     );

//     // Forward media if present
//     if ('photo' in ctx.message || 'document' in ctx.message || 'voice' in ctx.message) {
//       await ctx.api.copyMessage(
//         ticket.userId,
//         ctx.chat!.id,
//         ctx.message.message_id
//       );
//     }

//     // Update ticket
//     ticket.status = TicketStatus.IN_PROGRESS;
//     ticket.messages.push({
//       from: 'technician',
//       text: replyText,
//       timestamp: new Date(),
//       messageId: ctx.message.message_id,
//       groupMessageId: ctx.message.message_id,
//       technicianId,
//       technicianName
//     });

//     if (!ticket.assignedTo) {
//       ticket.assignedTo = technicianId;
//       ticket.assignedToName = technicianName;
//     }

//     await ticket.save();

//     // Confirm with reaction
//     await ctx.react('👍');

//     console.log(`✅ Reply sent for ${ticket.ticketId} by ${technicianName}`);

//   } catch (error) {
//     console.error('Error handling tech reply:', error);
//     await ctx.reply('❌ Failed to send reply.');
//   }
// }

import { BotContext } from '../../types';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { isTechnicianGroup } from '../../utils/chatContext';
import { loadConfig } from '../../config/loader';

/**
 * Handles technician replies to tickets
 */
export async function handleTechnicianReply(ctx: BotContext): Promise<void> {
  const config = loadConfig();
  
  if (!isTechnicianGroup(ctx, config.groups.technician_group_id)) {
    return;
  }

  if (!ctx.message || !('reply_to_message' in ctx.message) || !ctx.message.reply_to_message) {
    return;
  }

  const replyToMessageId = ctx.message.reply_to_message.message_id;

  try {
    // FIX: Removed the restrictive 'techGroupMessageId: replyToMessageId' from the top level
    // Now it searches purely based on the $or conditions
    const ticket = await Ticket.findOne({
      status: { $ne: TicketStatus.CLOSED },
      $or: [
        { techGroupMessageId: replyToMessageId },       // Reply to original bot post
        { 'messages.groupMessageId': replyToMessageId }, // Reply to a user's forwarded reply
        { 'messages.messageId': replyToMessageId, 'messages.from': 'technician' } // Reply to another tech
      ]
    });

    if (!ticket) return;

    // Extract reply
    let replyText = '';
    if ('text' in ctx.message && ctx.message.text) {
      replyText = ctx.message.text;
    } else if ('caption' in ctx.message && ctx.message.caption) {
      replyText = ctx.message.caption;
    } else {
      replyText = '[Support sent a media response]';
    }

    const technicianId = ctx.from?.id;
    const technicianName = ctx.from?.first_name || 'Support';

    // Send to user
    await ctx.api.sendMessage(
      ticket.userId,
      `💬 *Support Response* (${ticket.ticketId})\n\n` +
      `From: ${technicianName}\n\n` +
      `${replyText}`,
      { parse_mode: 'Markdown' }
    );

    // Forward media if present
    if ('photo' in ctx.message || 'document' in ctx.message || 'voice' in ctx.message) {
      await ctx.api.copyMessage(
        ticket.userId,
        ctx.chat!.id,
        ctx.message.message_id
      );
    }

    // Update ticket
    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.messages.push({
      from: 'technician',
      text: replyText,
      timestamp: new Date(),
      messageId: ctx.message.message_id,
      groupMessageId: ctx.message.message_id, // Tech replies exist directly in group
      technicianId,
      technicianName
    });

    if (!ticket.assignedTo) {
      ticket.assignedTo = technicianId;
      ticket.assignedToName = technicianName;
    }

    await ticket.save();

    // Confirm with reaction
    await ctx.react('👍');

    console.log(`✅ Reply sent for ${ticket.ticketId} by ${technicianName}`);

  } catch (error) {
    console.error('Error handling tech reply:', error);
    await ctx.reply('❌ Failed to send reply.');
  }
}