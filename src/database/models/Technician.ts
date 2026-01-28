import mongoose, { Schema, Document } from 'mongoose';

export interface ITechnician extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  role: 'admin' | 'technician';
  linkedAt: Date;
}

const TechnicianSchema = new Schema<ITechnician>({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  firstName: { type: String, required: true },
  lastName: { type: String },
  role: { type: String, enum: ['admin', 'technician'], default: 'technician' },
  linkedAt: { type: Date, default: Date.now }
});

export const Technician = mongoose.model<ITechnician>('Technician', TechnicianSchema);