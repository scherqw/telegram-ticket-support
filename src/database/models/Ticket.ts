import mongoose, { Schema, Document } from 'mongoose';

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed'
}

export interface ITicketMessage {
  from: 'user' | 'technician';
  text: string;
  timestamp: Date;
  
  // Message IDs for reference
  userMessageId?: number;      // Message ID in user's DM
  topicMessageId?: number;     // Message ID in forum topic
  
  // Technician info
  technicianId?: number;
  technicianName?: string;
  
  // Media tracking
  hasMedia?: boolean;
  mediaType?: 'photo' | 'document' | 'voice' | 'video' | 'audio' | 'sticker';
  fileId?: string;             // Telegram file_id for media
  
  // S3 storage (NEW)
  s3Key?: string;              // S3 object key: "tickets/TICK-0001/photo_123.jpg"
  s3Url?: string;              // Full S3 URL for accessing the file
}

export interface ITicket extends Document {
  // === Identity ===
  ticketId: string;
  userId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  
  // === Telegram Forum Mapping ===
  topicId?: number;            // message_thread_id in tech group
  topicName?: string;          // "TICK-0001 - John Doe"
  techGroupChatId: number;     // The forum supergroup ID
  
  // === Status ===
  status: TicketStatus;
  
  // === Messages (Permanent Transcript) ===
  messages: ITicketMessage[];
  initialMessage: string;      // First message that created ticket
  
  // === Assignment ===
  assignedTo?: number;
  assignedToName?: string;
  
  // === Rating ===
  rating?: {
    stars: number;             // 1-5
    ratedAt: Date;
    comment?: string;          // Optional user comment
  };
  
  // === Categorization ===
  categories: string[];        // Array of category IDs (e.g., ['account', 'billing'])
  categorizedBy?: number;      // Technician who categorized
  categorizedAt?: Date;        // When it was categorized
  
  // === Archive ===
  archivedAt?: Date;           // When ticket was archived
  archiveTopicId?: number;     // Topic ID in archive group
  archiveTopicName?: string;   // Topic name in archive
  
  // === Timestamps ===
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

const TicketSchema = new Schema<ITicket>({
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: Number,
    required: true,
    index: true
  },
  username: String,
  firstName: {
    type: String,
    required: true
  },
  lastName: String,
  
  // === Forum Topic Fields ===
  topicId: {
    type: Number,
    index: true,
    sparse: true
  },
  topicName: String,
  techGroupChatId: {
    type: Number,
    required: true
  },
  
  // === Status ===
  status: {
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.OPEN,
    index: true
  },
  
  // === Messages ===
  messages: [{
    from: {
      type: String,
      enum: ['user', 'technician'],
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 4000
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    userMessageId: Number,
    topicMessageId: Number,
    technicianId: Number,
    technicianName: String,
    hasMedia: Boolean,
    mediaType: String,
    fileId: String,
    // NEW: S3 fields
    s3Key: String,
    s3Url: String
  }],
  
  initialMessage: {
    type: String,
    required: true,
    maxlength: 4000
  },
  
  // === Assignment ===
  assignedTo: Number,
  assignedToName: String,
  
  // === Rating ===
  rating: {
    stars: {
      type: Number,
      min: 1,
      max: 5
    },
    ratedAt: Date,
    comment: {
      type: String,
      maxlength: 500
    }
  },
  
  // === Categorization ===
  categories: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  categorizedBy: Number,
  categorizedAt: Date,
  
  // === Archive ===
  archivedAt: Date,
  archiveTopicId: Number,
  archiveTopicName: String,
  
  // === Timestamps ===
  closedAt: Date,
}, {
  timestamps: true
});

// === Indexes for Performance ===
TicketSchema.index({ userId: 1, status: 1 });
TicketSchema.index({ topicId: 1, status: 1 });
TicketSchema.index({ status: 1, closedAt: 1 });
TicketSchema.index({ categories: 1, status: 1 });
TicketSchema.index({ 'rating.stars': 1 });

// === Auto-generate Ticket IDs ===
// UPDATED: Finds the last ticket ID and increments, instead of counting documents.
TicketSchema.pre('validate', async function() {
  if (this.isNew && !this.ticketId) {
    // Find the latest ticket by sorting ID descending
    const lastTicket = await mongoose.model('Ticket').findOne({}, { ticketId: 1 }).sort({ ticketId: -1 });
    
    let nextNum = 1;
    
    if (lastTicket && lastTicket.ticketId) {
      const parts = lastTicket.ticketId.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
          nextNum = num + 1;
        }
      }
    }
    
    this.ticketId = `TICK-${String(nextNum).padStart(4, '0')}`;
  }
});

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);