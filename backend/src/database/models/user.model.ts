import { Schema, model, models, type Document, type Types } from 'mongoose';

export type UserRole = 'admin' | 'staff' | 'user';
export type UserGender = 'male' | 'female';
export type AuthProviderName = 'google' | 'facebook' | 'apple';

export interface IUserAddress {
  _id?: Types.ObjectId;
  customerName: string;
  province: string;
  district: string;
  ward: string;
  streetName: string;
  phoneNumber: string;
  isDefault: boolean;
}

export interface IUserAuthProvider {
  provider: AuthProviderName;
  providerId: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  gender: UserGender;
  dateOfBirth: Date;
  address: IUserAddress[];
  membership?: Types.ObjectId | null;
  loyaltyPoint: number;
  membershipUpdatedAt?: Date | null;
  refreshToken?: string | null;
  authProviders: IUserAuthProvider[];
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  avatarImage?: string | null;
  avatarPublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

const userAddressSchema = new Schema<IUserAddress>(
  {
    customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    province: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    district: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    ward: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    streetName: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
    phoneNumber: { type: String, required: true, trim: true, match: vietnamPhoneRegex },
    isDefault: { type: Boolean, default: false },
  },
);

const authProviderSchema = new Schema<IUserAuthProvider>(
  {
    provider: { type: String, enum: ['google', 'facebook', 'apple'], required: true },
    providerId: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, enum: ['admin', 'staff', 'user'], required: true, default: 'user' },
    phone: { type: String, required: true, trim: true, match: vietnamPhoneRegex },
    gender: { type: String, enum: ['male', 'female'], required: true },
    dateOfBirth: { type: Date, required: true },
    address: {
      type: [userAddressSchema],
      required: true,
      validate: {
        validator: (value: IUserAddress[]) => value.length > 0,
        message: 'User must have at least one address',
      },
    },
    membership: { type: Schema.Types.ObjectId, ref: 'MembershipRanking', default: null },
    loyaltyPoint: { type: Number, default: 0, min: 0 },
    membershipUpdatedAt: { type: Date, default: null },
    refreshToken: { type: String, default: null },
    authProviders: { type: [authProviderSchema], default: [] },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    avatarImage: { type: String, default: null, maxlength: 1000 },
    avatarPublicId: { type: String, default: null, maxlength: 255 },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 });
userSchema.index({ membership: 1 });

export const User = models.User || model<IUser>('User', userSchema);

