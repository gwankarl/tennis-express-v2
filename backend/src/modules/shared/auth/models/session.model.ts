import mongoose, { model, Schema } from 'mongoose';

import { SESSION_STATUSES } from '../types/session.types.js';
import type { AuthSession } from '../types/session.types.js';

const sessionSchema = new Schema<AuthSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: SESSION_STATUSES,
      default: 'active',
      required: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/* Supports session lookup by user and lifecycle status. */
sessionSchema.index({ userId: 1, status: 1 });

/* Supports queries that find expired sessions. */
sessionSchema.index({ expiresAt: 1 });

sessionSchema.index({ refreshTokenHash: 1 }, { unique: true });

/*
 * Reuse the registered model when available, avoiding duplicate model
 * registration during module reloads and test execution.
 */
export const SessionModel =
  mongoose.models.AuthSession ??
  model<AuthSession>('AuthSession', sessionSchema);
