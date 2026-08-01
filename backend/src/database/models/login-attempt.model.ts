import { Schema, model, models, type Document } from 'mongoose';

export interface ILoginAttempt extends Document {
  key: string;
  failedAttempts: number;
  windowStartedAt: Date;
  lockedUntil?: Date | null;
  lockLevel: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const loginAttemptSchema = new Schema<ILoginAttempt>(
  {
    key: { type: String, required: true, unique: true, maxlength: 64 },
    failedAttempts: { type: Number, required: true, default: 0, min: 0 },
    windowStartedAt: { type: Date, required: true },
    lockedUntil: { type: Date, default: null },
    lockLevel: { type: Number, required: true, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'login_attempts', timestamps: true, versionKey: false },
);

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginAttempt =
  models.LoginAttempt || model<ILoginAttempt>('LoginAttempt', loginAttemptSchema);
