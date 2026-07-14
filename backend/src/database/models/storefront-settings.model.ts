import { Schema, model, models, type Document, type Types } from 'mongoose';

export const storefrontSocialPlatforms = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'zalo',
  'other',
] as const;

export type StorefrontSocialPlatform = typeof storefrontSocialPlatforms[number];

export interface IStorefrontIdentity {
  name: string;
  legalName: string;
  taxCode: string;
  tagline: string;
  description: string;
}

export interface IStorefrontContact {
  phone: string;
  email: string;
  hours: string;
  address: string;
  mapUrl: string;
}

export interface IStorefrontSocialLink {
  platform: StorefrontSocialPlatform;
  label: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
}

export interface IStorefrontSettings extends Document {
  key: 'storefront';
  identity: IStorefrontIdentity;
  contact: IStorefrontContact;
  socials: IStorefrontSocialLink[];
  version: number;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const identitySchema = new Schema<IStorefrontIdentity>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    legalName: { type: String, default: '', trim: true, maxlength: 160 },
    taxCode: { type: String, default: '', trim: true, maxlength: 30 },
    tagline: { type: String, default: '', trim: true, maxlength: 160 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false },
);

const contactSchema = new Schema<IStorefrontContact>(
  {
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
    hours: { type: String, default: '', trim: true, maxlength: 120 },
    address: { type: String, default: '', trim: true, maxlength: 300 },
    mapUrl: { type: String, default: '', trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const socialLinkSchema = new Schema<IStorefrontSocialLink>(
  {
    platform: { type: String, enum: storefrontSocialPlatforms, required: true },
    label: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const storefrontSettingsSchema = new Schema<IStorefrontSettings>(
  {
    key: { type: String, enum: ['storefront'], required: true, default: 'storefront', unique: true, immutable: true },
    identity: { type: identitySchema, required: true },
    contact: { type: contactSchema, required: true },
    socials: { type: [socialLinkSchema], default: [] },
    version: { type: Number, required: true, default: 1, min: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export const StorefrontSettings = models.StorefrontSettings
  || model<IStorefrontSettings>('StorefrontSettings', storefrontSettingsSchema);
