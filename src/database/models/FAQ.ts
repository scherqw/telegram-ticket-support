import mongoose, { Schema, Document } from 'mongoose';

export interface IFAQ extends Document {
  question: string;
  answer: string;
  category: string;
  // keywords: string[];
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FAQSchema = new Schema<IFAQ>({
  question: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  answer: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 4000
  },
  category: {
    type: String,
    default: 'General',
    trim: true
  },
  // keywords: [{
  //   type: String,
  //   lowercase: true,
  //   trim: true
  // }],
  order: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
FAQSchema.index({ keywords: 1, isActive: 1 });
FAQSchema.index({ category: 1, order: 1 });

export const FAQ = mongoose.model<IFAQ>('FAQ', FAQSchema);
