import { Schema, model, models, type Document, type Types } from 'mongoose';

export type UserRole = 'admin' | 'staff' | 'user';
export type UserGender = 'male' | 'female';
export type AuthProviderName = 'google' | 'facebook' | 'apple';
export type StaffPermission =
  | 'products.read'
  | 'products.write'
  | 'catalog.read'
  | 'catalog.write'
  | 'orders.read'
  | 'orders.update'
  | 'payments.adjust'
  | 'audit.read'
  | 'inventory.read'
  | 'inventory.write'
  | 'promotions.read'
  | 'promotions.write'
  | 'loyalty.read'
  | 'loyalty.write'
  | 'customers.read'
  | 'customers.manage'
  | 'reviews.moderate'
  | 'support.reply'
  | 'support.manage'
  | 'reports.read';

export interface IUserAddress {
  _id?: Types.ObjectId;
  customerName: string;
  province: string;
  provinceCode?: string | null;
  provinceId?: number | null;
  district?: string | null;
  districtId?: number | null;
  ward: string;
  wardCode: string;
  streetName: string;
  phoneNumber: string;
  ghnProvinceId?: number | null;
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
  ghnMappingStatus?: 'mapped' | 'missing' | 'manual';
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
  permissions: StaffPermission[];
  mustChangePassword: boolean;
  createdBy?: Types.ObjectId | null;
  passwordChangedAt?: Date | null;
  lastLoginAt?: Date | null;
  profileCompleted: boolean;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  avatarImage?: string | null;
  avatarPublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

const requiresCompletedProfile = function (this: IUser) {
  return this.profileCompleted !== false;
};

const userAddressSchema = new Schema<IUserAddress>(
  {
    customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    province: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    provinceCode: { type: String, default: null, trim: true, maxlength: 20 },
    provinceId: { type: Number, default: null, min: 1 },
    district: { type: String, default: null, trim: true, maxlength: 80 },
    districtId: { type: Number, default: null, min: 1 },
    ward: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    wardCode: { type: String, required: true, trim: true, maxlength: 20 },
    streetName: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
    phoneNumber: { type: String, required: true, trim: true, match: vietnamPhoneRegex },
    ghnProvinceId: { type: Number, default: null, min: 1 },
    ghnDistrictId: { type: Number, default: null, min: 1 },
    ghnWardCode: { type: String, default: null, trim: true, maxlength: 20 },
    ghnMappingStatus: { type: String, enum: ['mapped', 'missing', 'manual'], default: 'missing' },
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
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, enum: ['admin', 'staff', 'user'], required: true, default: 'user' },
    phone: { type: String, required: requiresCompletedProfile, trim: true, match: vietnamPhoneRegex },
    gender: { type: String, enum: ['male', 'female'], required: requiresCompletedProfile },
    dateOfBirth: { type: Date, required: requiresCompletedProfile },
    address: {
      type: [userAddressSchema],
      required: requiresCompletedProfile,
      validate: {
        validator(this: unknown, value: IUserAddress[]) {
          const context = this as { profileCompleted?: boolean };
          return context.profileCompleted === false || value.length > 0;
        },
        message: 'User must have at least one address',
      },
    },
    membership: { type: Schema.Types.ObjectId, ref: 'MembershipRanking', default: null },
    loyaltyPoint: { type: Number, default: 0, min: 0 },
    membershipUpdatedAt: { type: Date, default: null },
    refreshToken: { type: String, default: null },
    authProviders: { type: [authProviderSchema], default: [] },
    permissions: { type: [String], default: [] },
    mustChangePassword: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    passwordChangedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    profileCompleted: { type: Boolean, default: true },
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
userSchema.index({ role: 1, isActive: 1 });

export const User = models.User || model<IUser>('User', userSchema);

