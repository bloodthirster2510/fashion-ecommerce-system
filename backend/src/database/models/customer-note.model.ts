import { Schema, model, models, type Document, type Types } from 'mongoose';

export interface ICustomerNote extends Document {
  customerId: Types.ObjectId;
  content: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerNoteSchema = new Schema<ICustomerNote>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

customerNoteSchema.index({ customerId: 1, createdAt: -1 });

export const CustomerNote =
  models.CustomerNote || model<ICustomerNote>('CustomerNote', customerNoteSchema);
