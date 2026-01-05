// import { BotContext } from '../../types';
// import { ITicket } from '../../database/models/Ticket';
// import { loadConfig } from '../../config/loader';
// import { escapeMarkdown } from '../../utils/formatters';
// /**
//  * Archives a closed ticket to the archive group
//  * 
//  * This creates a new topic in the archive group and sends a summary
//  * of the ticket conversation there for permanent storage
//  * 
//  * @param ticket - The ticket to archive
//  * @param botApi - Bot API instance
//  */
// export async function archiveTicket(
//   ticket: ITicket,
//   botApi: any
// ): Promise<void> {
//   const config = loadConfig();

//   if (!config.features.enable_archiving) {
//     console.log('⚠️  Archiving is disabled in config');
//     return;
//   }

//   if (!config.groups.archive_group_id) {
//     console.error('❌ Archive group ID not configured');
//     return;
//   }

//   try {
//     // ===== STEP 1: Create archive topic =====
//     const archiveTopicName = `📦 [CLOSED] ${ticket.ticketId} - ${ticket.firstName}`;
    
//     const archiveTopic = await botApi.createForumTopic(
//       config.groups.archive_group_id,
//       archiveTopicName,
//       {
//         icon_color: 0x808080  // Gray color for closed tickets
//       }
//     );

//     ticket.archiveTopicId = archiveTopic.message_thread_id;
//     ticket.archiveTopicName = archiveTopicName;
//     ticket.archivedAt = new Date();

//     // ===== STEP 2: Send ticket summary to archive =====
//     const summary = buildTicketSummary(ticket);
    
//     await botApi.sendMessage(
//       config.groups.archive_group_id,
//       summary,
//       {
//         message_thread_id: archiveTopic.message_thread_id,
//         parse_mode: 'Markdown'
//       }
//     );

//     // ===== STEP 3: Send conversation transcript =====
//     if (ticket.messages && ticket.messages.length > 0) {
//       const transcript = buildConversationTranscript(ticket);
      
//       // Split transcript if too long (Telegram limit: 4096 chars)
//       const chunks = splitMessage(transcript, 4000);
      
//       for (const chunk of chunks) {
//         await botApi.sendMessage(
//           config.groups.archive_group_id,
//           chunk,
//           {
//             message_thread_id: archiveTopic.message_thread_id,
//             parse_mode: 'Markdown'
//           }
//         );
        
//         // Small delay to avoid rate limits
//         await sleep(100);
//       }
//     }

//     // ===== STEP 4: Add archive footer =====
//     await botApi.sendMessage(
//       config.groups.archive_group_id,
//       '─────────────────\n' +
//       '📦 *Archived Ticket*\n' +
//       `This is a permanent archive of ticket ${ticket.ticketId}.\n` +
//       `Archived: ${new Date().toLocaleString()}`,
//       {
//         message_thread_id: archiveTopic.message_thread_id,
//         parse_mode: 'Markdown'
//       }
//     );

//     await ticket.save();

//     console.log(`📦 Ticket ${ticket.ticketId} archived to topic ${archiveTopic.message_thread_id}`);

//   } catch (error: any) {
//     console.error(`❌ Failed to archive ticket ${ticket.ticketId}:`, error.message);
//     // Don't throw - archiving failure shouldn't break ticket closure
//   }
// }

// /**
//  * Builds ticket summary message
//  */
// function buildTicketSummary(ticket: ITicket): string {
//   const userName = ticket.firstName + 
//     (ticket.lastName ? ' ' + ticket.lastName : '') +
//     (ticket.username ? ` (@${ticket.username})` : '');

//   const categories = ticket.categories && ticket.categories.length > 0
//     ? ticket.categories.join(', ')
//     : 'None';

//   const rating = ticket.rating
//     ? `${'⭐'.repeat(ticket.rating.stars)} (${ticket.rating.stars}/5)`
//     : 'Not rated';

//   const assignedTo = ticket.assignedToName || 'Unassigned';


//   return (
//     `📦 *ARCHIVED TICKET SUMMARY*\n\n` +
//     `🎫 *Ticket ID:* ${ticket.ticketId}\n` +
//     `👤 *User:* ${escapeMarkdown(userName)}\n` +
//     `🆔 *User ID:* \`${ticket.userId}\`\n` +
//     `👨‍💼 *Assigned To:* ${assignedTo}\n` +
//     `📂 *Categories:* ${categories}\n` +
//     `⭐ *Rating:* ${rating}\n` +
//     `💬 *Messages:* ${ticket.messages.length}\n` +
//     `📅 *Created:* ${formatDate(ticket.createdAt)}\n` +
//     `📅 *Closed:* ${formatDate(ticket.closedAt!)}\n\n` +
//     `*Initial Request:*\n${ticket.initialMessage}\n\n` +
//     `─────────────────`
//   );
// }

// /**
//  * Builds conversation transcript
//  */
// function buildConversationTranscript(ticket: ITicket): string {
//   let transcript = '💬 *CONVERSATION TRANSCRIPT*\n\n';

//   ticket.messages.forEach((msg, index) => {
//     const timestamp = formatDate(msg.timestamp);
//     const sender = msg.from === 'user' 
//       ? `👤 ${ticket.firstName}` 
//       : `👨‍💼 ${msg.technicianName || 'Support'}`;
    
//     transcript += `**[${index + 1}] ${sender}** - ${timestamp}\n`;
//     transcript += `${msg.text}\n`;
    
//     if (msg.hasMedia) {
//       transcript += `📎 [${msg.mediaType || 'Attachment'}]\n`;
//     }
    
//     transcript += '\n';
//   });

//   return transcript;
// }

// /**
//  * Formats date for display
//  */
// function formatDate(date: Date): string {
//   return new Date(date).toLocaleString('en-US', {
//     year: 'numeric',
//     month: 'short',
//     day: 'numeric',
//     hour: '2-digit',
//     minute: '2-digit'
//   });
// }

// /**
//  * Splits a message into chunks to avoid Telegram's 4096 character limit
//  */
// function splitMessage(text: string, maxLength: number): string[] {
//   const chunks: string[] = [];
//   let currentChunk = '';

//   const lines = text.split('\n');

//   for (const line of lines) {
//     if (currentChunk.length + line.length + 1 > maxLength) {
//       if (currentChunk) {
//         chunks.push(currentChunk);
//         currentChunk = '';
//       }
      
//       // If single line is too long, split it
//       if (line.length > maxLength) {
//         for (let i = 0; i < line.length; i += maxLength) {
//           chunks.push(line.substring(i, i + maxLength));
//         }
//       } else {
//         currentChunk = line;
//       }
//     } else {
//       currentChunk += (currentChunk ? '\n' : '') + line;
//     }
//   }

//   if (currentChunk) {
//     chunks.push(currentChunk);
//   }

//   return chunks;
// }

// /**
//  * Helper: Sleep for specified milliseconds
//  */
// function sleep(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }
import { BotContext } from '../../types';
import { ITicket, ITicketMessage } from '../../database/models/Ticket';
import { loadConfig } from '../../config/loader';
import { escapeMarkdown } from '../../utils/formatters';

/**
 * Archives a closed ticket to the archive group
 */
export async function archiveTicket(
  ticket: ITicket,
  botApi: any
): Promise<void> {
  const config = loadConfig();

  if (!config.features.enable_archiving) {
    return;
  }

  if (!config.groups.archive_group_id) {
    console.error('❌ Archive group ID not configured');
    return;
  }

  try {
    // ===== STEP 1: Create archive topic =====
    // Use safe user name to prevent markdown errors
    const safeUser = escapeMarkdown(ticket.firstName);
    const archiveTopicName = `📦 [CLOSED] ${ticket.ticketId} - ${safeUser}`;
    
    const archiveTopic = await botApi.createForumTopic(
      config.groups.archive_group_id,
      archiveTopicName,
      {
        icon_color: 0x808080  // Gray color for closed tickets
      }
    );

    ticket.archiveTopicId = archiveTopic.message_thread_id;
    ticket.archiveTopicName = archiveTopicName;
    ticket.archivedAt = new Date();

    // ===== STEP 2: Send ticket summary to archive =====
    const summary = buildTicketSummary(ticket);
    
    await botApi.sendMessage(
      config.groups.archive_group_id,
      summary,
      {
        message_thread_id: archiveTopic.message_thread_id,
        parse_mode: 'Markdown'
      }
    );

    // ===== STEP 3: Send conversation transcript WITH MEDIA =====
    if (ticket.messages && ticket.messages.length > 0) {
      await sendTranscriptWithMedia(
        botApi, 
        ticket, 
        archiveTopic.message_thread_id, 
        config.groups.archive_group_id
      );
    }

    // ===== STEP 4: Add archive footer =====
    await botApi.sendMessage(
      config.groups.archive_group_id,
      '─────────────────\n' +
      '📦 *Archived Ticket*\n' +
      `This is a permanent archive of ticket ${ticket.ticketId}.\n` +
      `Archived: ${new Date().toLocaleString()}`,
      {
        message_thread_id: archiveTopic.message_thread_id,
        parse_mode: 'Markdown'
      }
    );

    await ticket.save();

    console.log(`📦 Ticket ${ticket.ticketId} archived to topic ${archiveTopic.message_thread_id}`);

  } catch (error: any) {
    console.error(`❌ Failed to archive ticket ${ticket.ticketId}:`, error.message);
  }
}

/**
 * Iterates through messages and sends them to the archive, preserving media
 */
async function sendTranscriptWithMedia(
  api: any, 
  ticket: ITicket, 
  threadId: number, 
  chatId: number
): Promise<void> {
  await api.sendMessage(chatId, '💬 *CONVERSATION TRANSCRIPT*', { 
    message_thread_id: threadId, 
    parse_mode: 'Markdown' 
  });

  let textBuffer = '';

  for (const [index, msg] of ticket.messages.entries()) {
    // Prepare Header: "[1] 👤 Name - Date"
    const timestamp = formatDate(msg.timestamp);
    const senderIcon = msg.from === 'user' ? '👤' : '👨‍💼';
    const senderName = msg.from === 'user' 
      ? ticket.firstName 
      : (msg.technicianName || 'Support');
      
    // Escape header info for Markdown
    const header = `*[${index + 1}] ${senderIcon} ${escapeMarkdown(senderName)} - ${timestamp}*\n`;

    // Process Content
    if (msg.hasMedia && msg.fileId) {
      // 1. Flush any pending text messages first
      if (textBuffer) {
        await sendBufferedText(api, chatId, threadId, textBuffer);
        textBuffer = '';
      }

      // 2. Send the Media File
      const captionText = msg.text ? `\n${msg.text}` : ''; // Don't escape caption for media, plain text is safer or minimal
      
      try {
        await sendMediaMessage(api, chatId, threadId, msg, header + captionText);
      } catch (error) {
        console.error(`Failed to send media for msg ${index}:`, error);
        // Fallback: Add error note to text buffer
        textBuffer += `${header}⚠️ [Error: Could not load ${msg.mediaType}]\n${msg.text}\n\n`;
      }
      
      // Small delay to prevent rate limits
      await sleep(200);

    } else {
      // It is a Text Message: Add to buffer
      // We escape the message text to prevent user input from breaking the Markdown format
      const safeBody = escapeMarkdown(msg.text);
      textBuffer += `${header}${safeBody}\n\n`;

      // Flush if buffer gets too big (Telegram limit is 4096)
      if (textBuffer.length > 3500) {
        await sendBufferedText(api, chatId, threadId, textBuffer);
        textBuffer = '';
        await sleep(200);
      }
    }
  }

  // Final flush of any remaining text
  if (textBuffer) {
    await sendBufferedText(api, chatId, threadId, textBuffer);
  }
}

/**
 * Helper: Sends buffered text to Telegram
 */
async function sendBufferedText(api: any, chatId: number, threadId: number, text: string) {
  try {
    await api.sendMessage(chatId, text, {
      message_thread_id: threadId,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    // Fallback if Markdown parsing fails (e.g. weird user input)
    console.warn('Markdown failed, sending plain text');
    await api.sendMessage(chatId, text, {
      message_thread_id: threadId
    });
  }
}

/**
 * Helper: Sends the specific media type
 */
async function sendMediaMessage(
  api: any, 
  chatId: number, 
  threadId: number, 
  msg: ITicketMessage, 
  caption: string
) {
  const options = {
    message_thread_id: threadId,
    caption: caption,
    parse_mode: 'Markdown'
  };

  switch (msg.mediaType) {
    case 'photo':
      await api.sendPhoto(chatId, msg.fileId, options);
      break;
    case 'document':
      await api.sendDocument(chatId, msg.fileId, options);
      break;
    case 'voice':
      await api.sendVoice(chatId, msg.fileId, options);
      break;
    case 'video':
      await api.sendVideo(chatId, msg.fileId, options);
      break;
    case 'audio':
      await api.sendAudio(chatId, msg.fileId, options);
      break;
    case 'sticker':
      // Stickers don't support captions, send header as text first
      await api.sendMessage(chatId, caption, { message_thread_id: threadId, parse_mode: 'Markdown' });
      await api.sendSticker(chatId, msg.fileId, { message_thread_id: threadId });
      break;
    default:
      await api.sendMessage(chatId, `${caption}\n[Unknown media type]`, options);
  }
}


/**
 * Builds ticket summary message
 */
function buildTicketSummary(ticket: ITicket): string {
  const userName = ticket.firstName + 
    (ticket.lastName ? ' ' + ticket.lastName : '') +
    (ticket.username ? ` (@${ticket.username})` : '');

  const categories = ticket.categories && ticket.categories.length > 0
    ? ticket.categories.join(', ')
    : 'None';

  // Safely check for rating
  const rating = (ticket.rating && typeof ticket.rating.stars === 'number')
    ? `${'⭐'.repeat(ticket.rating.stars)} (${ticket.rating.stars}/5)`
    : 'Pending / Not rated';

  const assignedTo = ticket.assignedToName || 'Unassigned';

  // Escape user input for summary
  return (
    `📦 *ARCHIVED TICKET SUMMARY*\n\n` +
    `🎫 *Ticket ID:* ${ticket.ticketId}\n` +
    `👤 *User:* ${escapeMarkdown(userName)}\n` +
    `🆔 *User ID:* \`${ticket.userId}\`\n` +
    `👨‍💼 *Assigned To:* ${escapeMarkdown(assignedTo)}\n` +
    `📂 *Categories:* ${escapeMarkdown(categories)}\n` +
    `⭐ *Rating:* ${rating}\n` +
    `💬 *Messages:* ${ticket.messages.length}\n` +
    `📅 *Created:* ${formatDate(ticket.createdAt)}\n` +
    `📅 *Closed:* ${ticket.closedAt ? formatDate(ticket.closedAt) : 'Unknown'}\n\n` +
    `*Initial Request:*\n${escapeMarkdown(ticket.initialMessage)}\n\n` +
    `─────────────────`
  );
}

/**
 * Formats date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}