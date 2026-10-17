import mongoose, { model, Schema, Types } from 'mongoose';

/**
 * Represents a persisted password-reset token.
 *
 * Only the hash of the raw token is stored. Expiration and one-time use
 * are enforced by the password-recovery service.
 */
export interface PasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

/* Defines the persistence rules for password-reset tokens. */
const passwordResetTokenSchema = new Schema<PasswordResetToken>(
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

/* Supports account-based queries and cleanup of expired tokens. */
passwordResetTokenSchema.index({ userId: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/*
 * Reuse the registered model when available to avoid duplicate-model
 * registration errors during repeated imports or test execution.
 */
export const PasswordResetTokenModel =
  mongoose.models.PasswordResetToken ??
  model<PasswordResetToken>('PasswordResetToken', passwordResetTokenSchema);
