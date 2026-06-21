import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface ISupportAttachment {
  url: string;
  publicId: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
}

export interface ISupportMessage extends Document {
  ticketId: Types.ObjectId;
  senderType: 'customer' | 'staff';
  senderId: Types.ObjectId;
  body: string;
  attachments: ISupportAttachment[];
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const supportAttachmentSchema = new Schema<ISupportAttachment>(
  {
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    publicId: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
  },
  { _id: false },
);

const supportMessageSchema = new Schema<ISupportMessage>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true },
    senderType: { type: String, enum: ['customer', 'staff'], required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 3000 },
    attachments: { type: [supportAttachmentSchema], default: [] },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: true },
);

supportMessageSchema.index({ ticketId: 1, createdAt: 1 });

export const SupportMessage = models.SupportMessage || model<ISupportMessage>('SupportMessage', supportMessageSchema);
