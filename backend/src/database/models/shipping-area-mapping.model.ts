import { Schema, model, models, type Document, type Types } from 'mongoose';

export type ShippingAreaMappingConfidence = 'exact' | 'manual' | 'legacy';
export type ShippingAreaMappingStatus = 'pending' | 'verified' | 'disabled';

export interface IShippingAreaMapping extends Document {
  provider: 'GHN';
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  provinceKey: string;
  wardKey: string;
  ghnProvinceId: number;
  ghnProvinceName?: string | null;
  ghnDistrictId: number;
  ghnDistrictName?: string | null;
  ghnWardCode: string;
  ghnWardName?: string | null;
  confidence: ShippingAreaMappingConfidence;
  status: ShippingAreaMappingStatus;
  verifiedAt?: Date | null;
  verifiedBy?: Types.ObjectId | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const shippingAreaMappingSchema = new Schema<IShippingAreaMapping>(
  {
    provider: { type: String, enum: ['GHN'], required: true, default: 'GHN' },
    provinceCode: { type: String, required: true, trim: true, maxlength: 20 },
    provinceName: { type: String, required: true, trim: true, maxlength: 100 },
    wardCode: { type: String, required: true, trim: true, maxlength: 20 },
    wardName: { type: String, required: true, trim: true, maxlength: 100 },
    provinceKey: { type: String, required: true, trim: true, maxlength: 100 },
    wardKey: { type: String, required: true, trim: true, maxlength: 100 },
    ghnProvinceId: { type: Number, required: true, min: 1 },
    ghnProvinceName: { type: String, default: null, trim: true, maxlength: 100 },
    ghnDistrictId: { type: Number, required: true, min: 1 },
    ghnDistrictName: { type: String, default: null, trim: true, maxlength: 100 },
    ghnWardCode: { type: String, required: true, trim: true, maxlength: 20 },
    ghnWardName: { type: String, default: null, trim: true, maxlength: 100 },
    confidence: {
      type: String,
      enum: ['exact', 'manual', 'legacy'],
      required: true,
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'disabled'],
      required: true,
      default: 'pending',
    },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: null, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

shippingAreaMappingSchema.index(
  { provider: 1, provinceCode: 1, wardCode: 1 },
  { unique: true },
);
shippingAreaMappingSchema.index({ provider: 1, provinceKey: 1, wardKey: 1, status: 1 });
shippingAreaMappingSchema.index({ provider: 1, status: 1, updatedAt: -1 });

export const ShippingAreaMapping =
  models.ShippingAreaMapping
  || model<IShippingAreaMapping>('ShippingAreaMapping', shippingAreaMappingSchema);
