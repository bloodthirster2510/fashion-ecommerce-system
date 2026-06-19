import { Schema, model, models, type Document } from 'mongoose';
import { hexColorRegex, iconNameRegex } from '../membership-visual';

export interface IMembershipRanking extends Document {
  name: string;
  level: number;
  minPoint: number;
  maxPoint: number | null;
  discountPercent: number;
  benefitDescription: string;
  cardColor: string;
  textColor: string;
  badgeColor: string;
  iconName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const membershipRankingSchema = new Schema<IMembershipRanking>(
  {
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 30 },
    level: { type: Number, required: true, min: 1, max: 20 },
    minPoint: { type: Number, required: true, min: 0, max: 100000000 },
    maxPoint: { type: Number, default: null },
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
    benefitDescription: { type: String, trim: true, minlength: 2, maxlength: 200 },
    cardColor: { type: String, default: '#5b788a', trim: true, match: hexColorRegex },
    textColor: { type: String, default: '#ffffff', trim: true, match: hexColorRegex },
    badgeColor: { type: String, default: '#5b788a', trim: true, match: hexColorRegex },
    iconName: { type: String, default: 'star', trim: true, lowercase: true, match: iconNameRegex },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

membershipRankingSchema.index({ level: 1 }, { unique: true });
membershipRankingSchema.index({ isActive: 1 });

export const MembershipRanking =
  models.MembershipRanking || model<IMembershipRanking>('MembershipRanking', membershipRankingSchema);
