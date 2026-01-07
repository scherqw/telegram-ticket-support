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
  
  // === Archive (NEW) ===
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
    sparse: true  // Allow null, but index if exists
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
    fileId: String
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
  
  // === Archive (NEW) ===
  archivedAt: Date,
  archiveTopicId: Number,
  archiveTopicName: String,
  
  // === Timestamps ===
  closedAt: Date,
}, {
  timestamps: true
});

// === Indexes for Performance ===
TicketSchema.index({ userId: 1, status: 1 });           // Find active ticket for user
TicketSchema.index({ topicId: 1, status: 1 });          // Find ticket by topic
TicketSchema.index({ status: 1, closedAt: 1 });         // Closed tickets query
TicketSchema.index({ categories: 1, status: 1 });       // NEW: Filter by category
TicketSchema.index({ 'rating.stars': 1 });              // NEW: Rating queries

// === Auto-generate Ticket IDs ===
TicketSchema.pre('validate', async function() {
  if (this.isNew && !this.ticketId) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketId = `TICK-${String(count + 1).padStart(4, '0')}`;
  }
});

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);