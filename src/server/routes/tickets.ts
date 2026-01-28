import { Router } from 'express';
import { Ticket, TicketStatus } from '../../database/models/Ticket';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import { handleMediaUpload } from '../controllers/mediaController';
import { sendMessageToUser } from '../controllers/messageController';
import { sendRatingRequest } from '../../handlers/rating/ratingHandler';
import { loadConfig } from '../../config/loader';
import { userBot } from '../../index'
import { InlineKeyboard } from 'grammy';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const config = loadConfig();

// Get all open tickets
router.get('/open', async (req: AuthRequest, res) => {
  try {
    const tickets = await Ticket.find({
      status: { $in: [
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
        TicketStatus.ESCALATED
      ]}
    })
      .sort({ hasUnreadMessages: -1, lastMessageAt: -1 })
      .limit(100);

    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get archived tickets
router.get('/archived', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const tickets = await Ticket.find({ status: TicketStatus.CLOSED })
      .sort({ closedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Ticket.countDocuments({ status: TicketStatus.CLOSED });

    res.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching archived tickets:', error);
    res.status(500).json({ error: 'Failed to fetch archived tickets' });
  }
});

router.get('/categories', (req: AuthRequest, res) => {
  try {
    const config = loadConfig();
    
    // We default to an empty array if undefined, just to be safe
    const categories = config.categories || []; 
    
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single ticket details
router.get('/:ticketId', async (req: AuthRequest, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    res.json({ ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Mark messages as read
router.post('/:ticketId/read', async (req: AuthRequest, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    ticket.hasUnreadMessages = false;
    
    // Mark all user messages as read
    ticket.messages.forEach(msg => {
      if (msg.from === 'user') {
        msg.isRead = true;
      }
    });
    
    await ticket.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Send text message
router.post('/:ticketId/reply', async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    await sendMessageToUser(
      ticket,
      message,
      req.user!
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Upload and send media
router.post('/:ticketId/media', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    await handleMediaUpload(
      ticket,
      req.file,
      req.body.caption || '',
      req.user!
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// Close ticket
router.post('/:ticketId/close', async (req: AuthRequest, res) => {
  try {
    const { categories } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    
    if (categories && categories.length > 0) {
      ticket.categories = categories;
      ticket.categorizedBy = req.user!.id;
      ticket.categorizedAt = new Date();
    }

    await ticket.save();

    // Send closure message to user
    
    try {
      await userBot.api.sendMessage(
        ticket.userId,
        `✅ *Ticket Closed: ${ticket.ticketId}*\n\n` +
        `Your support ticket has been resolved.\n\n` +
        `If you need further assistance, just send a new message!\n\n` +
        `Thank you for contacting support!`,
        { parse_mode: 'Markdown' }
      );
      
      // Send rating request if enabled
      if (config.features.enable_ratings) {
        setTimeout(() => {
          sendRatingRequest(ticket.userId, ticket.ticketId, userBot.api);
        }, 1000);
      }
    } catch (error) {
      console.error('Could not notify user:', error);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
});

router.post('/:ticketId/escalate', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });

    if (!ticket) {
      res.status(400).json({ error: 'Ticket not found' });
      return;
    }

    const level2Ids = config.admin.level2_ids || [];

    if (level2Ids.length === 0) {
      return res.status(400).json({ error: 'No level 2 technicians configured' });
    }

    ticket.status = TicketStatus.ESCALATED;
    ticket.assignedTo = undefined;
    ticket.assignedToName = undefined;

    ticket.messages.push({
      from: 'technician',
      text: `Ticket ESCALATED to Level 2\nReason: ${reason || 'No reason provided'}`,
      timestamp: new Date(),
      technicianName: `${req.user?.username}`,
      isRead: true
    } as any);

    await ticket.save();

    const keyboard = new InlineKeyboard()
      .url('Escalated Ticket', `${config.webapp.telegram_link}?startapp=${ticket.ticketId}`);

    const messageText = 
      `*ESCALATION ALERT*\n\n` +
      `*Ticket:* ${ticket.ticketId}\n` +
      `*Escalated By:* ${req.user?.first_name}\n` +
      `*Reason:* ${reason}\n\n` +
      `This ticket is now unassigned. The first to open it claims it.`;

    const notifications = level2Ids.map(id => 
      userBot.api.sendMessage(id, messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }).catch(error => console.error(`Failed to notify Level 2 technician ${id}`, error))
    )

    await Promise.all(notifications);

    res.json({ success: true });

  } catch (error) {
    console.error('Error escalating ticket:', error);
    res.status(500).json({ error: 'Failed to escalate ticket' });
  }
})

export { router as ticketRoutes };