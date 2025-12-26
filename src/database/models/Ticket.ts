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
  messageId?: number;
  groupMessageId?: number;
  technicianId?: number;
  technicianName?: string;
}

export interface ITicket extends Document {
  ticketId: string;
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  subject: string;
  status: TicketStatus;
  userMessageId: number;
  techGroupMessageId?: number;
  messages: ITicketMessage[];
  assignedTo?: number;
  assignedToName?: string;
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
  firstName: String,
  lastName: String,
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.OPEN,
    index: true
  },
  userMessageId: {
    type: Number,
    required: true
  },
  techGroupMessageId: {
    type: Number,
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
    messageId: Number,
    groupMessageId: Number,
    technicianId: Number,
    technicianName: String
  }],
  assignedTo: Number,
  assignedToName: String,
  closedAt: Date
}, {
  timestamps: true
});

// Compound indexes for efficient queries
TicketSchema.index({ userId: 1, status: 1 });
TicketSchema.index({ status: 1, createdAt: -1 });
TicketSchema.index({ techGroupMessageId: 1, status: 1 });
TicketSchema.index({ 'messages.groupMessageId': 1 });

// Auto-generate ticket IDs
TicketSchema.pre('validate', async function() {
  if (this.isNew && !this.ticketId) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketId = `TICK-${String(count + 1).padStart(4, '0')}`;
  }
});

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
