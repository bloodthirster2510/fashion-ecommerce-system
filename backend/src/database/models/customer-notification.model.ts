import { Schema, model, models, type Document, type Types } from 'mongoose';

export const CUSTOMER_NOTIFICATION_CATEGORIES = [
  'order',
  'promotion',
  'support',
  'account',
  'virtual_try_on',
  'system',
] as const;

export const CUSTOMER_NOTIFICATION_TYPES = [
  'order_status',
  'payment_status',
  'payment_deadline',
  'shipping_update',
  'promotion',
  'support_reply',
  'loyalty',
  'account',
  'virtual_try_on_completed',
  'virtual_try_on_partial',
  'virtual_try_on_failed',
  'virtual_try_on_policy',
  'virtual_try_on_access',
  'system',
] as const;

export const CUSTOMER_NOTIFICATION_ACTIONS = [
  'order_detail',
  'support_ticket_detail',
  'product_detail',
  'coupons',
  'membership',
  'profile',
  'virtual_try_on_result',
  'virtual_try_on_processing',
  'virtual_try_on_home',
] as const;

export type CustomerNotificationCategory = (typeof CUSTOMER_NOTIFICATION_CATEGORIES)[number];
export type CustomerNotificationType = (typeof CUSTOMER_NOTIFICATION_TYPES)[number];
export type CustomerNotificationAction = (typeof CUSTOMER_NOTIFICATION_ACTIONS)[number];

export interface ICustomerNotification extends Document {
  userId: Types.ObjectId;
  category: CustomerNotificationCategory;
  type: CustomerNotificationType;
  title: string;
  body: string;
  imageUrl?: string | null;
  action?: {
    type: CustomerNotificationAction;
    label?: string | null;
    entityId?: string | null;
  } | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date | null;
  dedupeKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const customerNotificationActionSchema = new Schema(
  {
    type: { type: String, enum: CUSTOMER_NOTIFICATION_ACTIONS, required: true },
    label: { type: String, trim: true, maxlength: 40, default: null },
    entityId: { type: String, trim: true, maxlength: 120, default: null },
  },
  { _id: false },
);

const customerNotificationSchema = new Schema<ICustomerNotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: CUSTOMER_NOTIFICATION_CATEGORIES, required: true },
    type: { type: String, enum: CUSTOMER_NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    imageUrl: { type: String, trim: true, maxlength: 500, default: null },
    action: { type: customerNotificationActionSchema, default: null },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, required: true, default: false },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, trim: true, maxlength: 180, default: null },
  },
  { timestamps: true, collection: 'customer_notifications' },
);

customerNotificationSchema.index({ userId: 1, _id: -1 });
customerNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
customerNotificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } },
  },
);

export const CustomerNotification = models.CustomerNotification ||
  model<ICustomerNotification>('CustomerNotification', customerNotificationSchema);
