import type { Types } from 'mongoose';

/** Lifecycle states for an authenticated session. */
export const SESSION_STATUSES = ['active', 'revoked'] as const;

/** A valid session lifecycle state. */
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * TypeScript representation of a persisted authentication session.
 */
export interface AuthSession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: SessionStatus;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
