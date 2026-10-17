import type { ClientSession } from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';
import { SessionModel } from '../models/session.model.js';
import type { AuthSession } from '../types/session.types.js';

/** Input required to create an authenticated session. */
export interface CreateSessionInput {
  userId: string;
  expiresAt: Date;
  refreshTokenHash: string;
}

/** Operations supported by the session persistence service. */
export class SessionService {
  /**
   * Persists a new active session.
   *
   * @param input - The owner and expiration time of the session.
   * @returns The newly created session document.
   */
  async createSession(input: CreateSessionInput): Promise<AuthSession> {
    const { userId, expiresAt, refreshTokenHash } = input;

    if (expiresAt.getTime() <= Date.now()) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SESSION_EXPIRY',
        message: 'Session expiration must be in the future.',
      });
    }

    const session = await SessionModel.create({
      userId,
      refreshTokenHash,
      expiresAt,
    });

    return session.toObject() as AuthSession;
  }

  /**
   * Finds a session that is active and has not expired.
   *
   * @param sessionId - The session document identifier.
   * @returns The session if it is currently valid; otherwise null.
   */
  async findValidSession(sessionId: string): Promise<AuthSession | null> {
    if (!/^[a-f\d]{24}$/i.test(sessionId)) {
      return null;
    }

    const session = await SessionModel.findOne({
      _id: sessionId,
      status: 'active',
      expiresAt: { $gt: new Date() },
      revokedAt: null,
    });

    return session ? (session.toObject() as AuthSession) : null;
  }

  /**
   * Replaces a refresh-token hash if its session is still valid.
   *
   * The conditional update prevents the same refresh token from being
   * rotated successfully more than once.
   *
   * @param currentTokenHash - Hash of the presented refresh token.
   * @param newTokenHash - Hash of the replacement refresh token.
   * @returns The updated session, or null if the old token is no longer valid.
   */
  async rotateRefreshToken(
    currentTokenHash: string,
    newTokenHash: string,
  ): Promise<AuthSession | null> {
    if (
      !/^[a-f\d]{64}$/i.test(currentTokenHash) ||
      !/^[a-f\d]{64}$/i.test(newTokenHash) ||
      currentTokenHash === newTokenHash
    ) {
      return null;
    }

    const session = await SessionModel.findOneAndUpdate(
      {
        refreshTokenHash: currentTokenHash,
        status: 'active',
        expiresAt: { $gt: new Date() },
        revokedAt: null,
      },
      {
        $set: {
          refreshTokenHash: newTokenHash,
        },
      },
      {
        new: true,
        runValidators: true,
        select: '+refreshTokenHash',
      },
    );

    return session ? (session.toObject() as AuthSession) : null;
  }

  /**
   * Revokes an active session.
   *
   * @param sessionId - The session document identifier.
   * @returns Whether an active session was revoked.
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    if (!/^[a-f\d]{24}$/i.test(sessionId)) {
      return false;
    }

    const result = await SessionModel.updateOne(
      {
        _id: sessionId,
        status: 'active',
        revokedAt: null,
      },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
        },
      },
    );

    return result.modifiedCount === 1;
  }

  /**
   * Finds an active session using its refresh-token hash.
   *
   * @param tokenHash - SHA-256 hash of the presented refresh token.
   * @returns The valid session, or null if no matching session exists.
   */
  async findValidSessionByRefreshTokenHash(
    tokenHash: string,
  ): Promise<AuthSession | null> {
    if (!/^[a-f\d]{64}$/i.test(tokenHash)) {
      return null;
    }

    const session = await SessionModel.findOne({
      refreshTokenHash: tokenHash,
      status: 'active',
      expiresAt: { $gt: new Date() },
      revokedAt: null,
    }).select('+refreshTokenHash');

    return session ? (session.toObject() as AuthSession) : null;
  }

  /**
   * Revokes every active session belonging to a user.
   *
   * @param userId - Identifier of the account whose sessions are revoked.
   * @returns The number of sessions revoked.
   */

  async revokeAllUserSessions(
    userId: string,
    session?: ClientSession,
  ): Promise<number> {
    if (!/^[a-f\d]{24}$/i.test(userId)) {
      return 0;
    }

    const result = await SessionModel.updateMany(
      {
        userId,
        status: 'active',
        revokedAt: null,
      },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
        },
      },
      { session },
    );

    return result.modifiedCount;
  }
}
