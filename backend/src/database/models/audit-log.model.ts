import { Schema, model, models, type Document, type Types } from 'mongoose';

export type AuditLogAction =
  | 'order.status_update'
  | 'order.shipping_update'
  | 'order.shipping_webhook'
  | 'payment.adjust'
  | 'payment.expire'
  | 'payment_method.status_update';

export interface IAuditLog extends Document {
  actorId?: Types.ObjectId | null;
  actorRole: 'admin' | 'staff' | 'system' | 'user';
  action: AuditLogAction;
  targetType: string;
  targetId: Types.ObjectId | string;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: {
      type: String,
      enum: ['admin', 'staff', 'system', 'user'],
      required: true,
    },
    action: {
      type: String,
      enum: [
        'order.status_update',
        'order.shipping_update',
        'order.shipping_webhook',
        'payment.adjust',
        'payment.expire',
        'payment_method.status_update',
      ],
      required: true,
    },
    targetType: { type: String, required: true, trim: true, maxlength: 80 },
    targetId: { type: Schema.Types.Mixed, required: true },
    reason: { type: String, trim: true, default: null, maxlength: 500 },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

export const AuditLog = models.AuditLog || model<IAuditLog>('AuditLog', auditLogSchema);
