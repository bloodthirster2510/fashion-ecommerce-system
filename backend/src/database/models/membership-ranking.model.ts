import { Schema, model, models, type Document } from 'mongoose';

export interface IMembershipRanking extends Document {
  name: string;
  level: number;
  minPoint: number;
  maxPoint: number | null;
  discountPercent: number;
  benefitDescription: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const membershipRankingSchema = new Schema<IMembershipRanking>(
  {
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 30 },
    level: { type: Number, required: true, unique: true, min: 1, max: 20 },
    minPoint: { type: Number, required: true, min: 0, max: 100000000 },
    maxPoint: { type: Number, default: null },
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
    benefitDescription: { type: String, trim: true, minlength: 2, maxlength: 200 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

membershipRankingSchema.index({ level: 1 }, { unique: true });
membershipRankingSchema.index({ isActive: 1 });

export const MembershipRanking =
  models.MembershipRanking || model<IMembershipRanking>('MembershipRanking', membershipRankingSchema);
