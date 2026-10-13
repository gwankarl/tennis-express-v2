import mongoose, { model, Schema, Types } from 'mongoose';

/**
 * Represents a persisted email-verification token.
 *
 * Only a hash of the raw token is stored. Expiration and consumption
 * are enforced by the verification service.
 */
export interface VerificationToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

/**
 * Defines the persistence rules for email-verification tokens.
 */
const verificationTokenSchema = new Schema<VerificationToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

/* Supports token lookups by account and automatic cleanup after expiry. */
verificationTokenSchema.index({ userId: 1 });
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/*
 * Reuse the registered model when available to avoid duplicate-model
 * registration errors during repeated imports or test execution.
 */
export const VerificationTokenModel =
  mongoose.models.VerificationToken ??
  model<VerificationToken>('VerificationToken', verificationTokenSchema);
