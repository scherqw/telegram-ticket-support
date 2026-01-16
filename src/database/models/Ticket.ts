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
  
  userMessageId?: number;
  technicianId?: number;
  technicianName?: string;
  
  hasMedia?: boolean;
  mediaType?: 'photo' | 'document' | 'voice' | 'video' | 'audio';
  fileId?: string;
  s3Key?: string;
  s3Url?: string;
  
  isRead?: boolean;
}

export interface ITicket extends Document {
  ticketId: string;
  userId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  
  status: TicketStatus;
  messages: ITicketMessage[];
  initialMessage: string;
  
  assignedTo?: number;
  assignedToName?: string;
  
  rating?: {
    stars: number;
    ratedAt: Date;
    comment?: string;
  };
  
  categories: string[];
  categorizedBy?: number;
  categorizedAt?: Date;
  
  hasUnreadMessages: boolean;
  lastMessageAt: Date;
  
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
  
  status: {
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.OPEN,
    index: true
  },
  
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
    technicianId: Number,
    technicianName: String,
    hasMedia: Boolean,
    mediaType: String,
    fileId: String,
    s3Key: String,
    s3Url: String,
    isRead: {
      type: Boolean,
      default: false
    }
  }],
  
  initialMessage: {
    type: String,
    required: true,
    maxlength: 4000
  },
  
  assignedTo: Number,
  assignedToName: String,
  
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
  
  categories: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  categorizedBy: Number,
  categorizedAt: Date,
  
  hasUnreadMessages: {
    type: Boolean,
    default: true,
    index: true
  },
  
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  closedAt: Date,
}, {
  timestamps: true
});

// Indexes for Web App queries
TicketSchema.index({ status: 1, hasUnreadMessages: 1, lastMessageAt: -1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ userId: 1, status: 1 });
TicketSchema.index({ 'rating.stars': 1 });

// Auto-generate Ticket IDs
TicketSchema.pre('validate', async function() {
  if (this.isNew && !this.ticketId) {
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