import { Schema, model, models, type Document, type Types } from 'mongoose';

export const SUPPORT_TICKET_TYPES = ['question', 'issue', 'complaint', 'feedback', 'suggestion'] as const;
export const SUPPORT_CATEGORIES = [
  'orders',
  'shipping',
  'returns',
  'payments',
  'promotions',
  'loyalty',
  'account',
  'product',
  'app_website',
  'service',
  'other',
] as const;
export const SUPPORT_TICKET_STATUSES = [
  'open',
  'pending_verification',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
  'spam',
] as const;
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export type SupportTicketType = typeof SUPPORT_TICKET_TYPES[number];
export type SupportCategory = typeof SUPPORT_CATEGORIES[number];
export type SupportTicketStatus = typeof SUPPORT_TICKET_STATUSES[number];
export type SupportPriority = typeof SUPPORT_PRIORITIES[number];

export interface ISupportContext {
  source: 'support_home' | 'order_detail' | 'payment_result' | 'coupon' | 'loyalty' | 'error_screen' | 'footer';
  appPlatform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  screen?: string;
  errorCode?: string;
}

export interface ISupportTicket extends Document {
  ticketCode: string;
  userId?: Types.ObjectId | null;
  guestContact?: {
    name: string;
    email: string;
    verificationTokenHash?: string | null;
    verificationExpiresAt?: Date | null;
    verifiedAt?: Date | null;
  } | null;
  type: SupportTicketType;
  category: SupportCategory;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportPriority;
  requiresReply: boolean;
  orderId?: Types.ObjectId | null;
  couponCode?: string | null;
  context?: ISupportContext | null;
  assignedTo?: Types.ObjectId | null;
  lastMessageAt: Date;
  lastMessageSender: 'customer' | 'staff';
  customerLastReadAt?: Date | null;
  staffLastReadAt?: Date | null;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  reopenDeadline?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const supportContextSchema = new Schema<ISupportContext>(
  {
    source: {
      type: String,
      enum: ['support_home', 'order_detail', 'payment_result', 'coupon', 'loyalty', 'error_screen', 'footer'],
      required: true,
    },
    appPlatform: { type: String, enum: ['ios', 'android', 'web'] },
    appVersion: { type: String, trim: true, maxlength: 40 },
    screen: { type: String, trim: true, maxlength: 100 },
    errorCode: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false },
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    guestContact: {
      type: new Schema({
        name: { type: String, required: true, trim: true, maxlength: 100 },
        email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
        verificationTokenHash: { type: String, default: null, select: false },
        verificationExpiresAt: { type: Date, default: null },
        verifiedAt: { type: Date, default: null },
      }, { _id: false }),
      default: null,
    },
    type: { type: String, enum: SUPPORT_TICKET_TYPES, required: true },
    category: { type: String, enum: SUPPORT_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, default: 'open' },
    priority: { type: String, enum: SUPPORT_PRIORITIES, default: 'normal' },
    requiresReply: { type: Boolean, default: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    couponCode: { type: String, trim: true, uppercase: true, maxlength: 50, default: null },
    context: { type: supportContextSchema, default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    lastMessageSender: { type: String, enum: ['customer', 'staff'], default: 'customer' },
    customerLastReadAt: { type: Date, default: Date.now },
    staffLastReadAt: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    reopenDeadline: { type: Date, default: null },
  },
  { timestamps: true },
);

supportTicketSchema.index({ userId: 1, updatedAt: -1 });
supportTicketSchema.index({ status: 1, 'guestContact.verificationExpiresAt': 1 });
supportTicketSchema.index({ status: 1, lastMessageSender: 1, lastMessageAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 });
supportTicketSchema.index({ orderId: 1 });

export const SupportTicket = models.SupportTicket || model<ISupportTicket>('SupportTicket', supportTicketSchema);
