import { createHash } from 'node:crypto';

import { AppError } from '../../../shared/errors/app-error.js';
import { UserModel } from '../../users/models/user.model.js';
import { VerificationTokenModel } from '../models/verification-token.model.js';

/** Matches the 32-byte hexadecimal tokens generated during registration. */
const VERIFICATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** Dependencies required to execute email verification. */
export interface EmailVerificationServiceDependencies {
  /** Supplies the current time, allowing expiration behavior to be tested. */
  now?: () => Date;
}

/**
 * Validates email-verification tokens and activates pending accounts.
 *
 * Token consumption is performed atomically so concurrent requests cannot
 * successfully claim the same token. Only the token hash is queried; the
 * raw token is never persisted or logged by this service.
 */
export class EmailVerificationService {
  private readonly now: () => Date;

  constructor(dependencies: EmailVerificationServiceDependencies = {}) {
    this.now = dependencies.now ?? (() => new Date());
  }

  /**
   * Verifies an email address and activates its pending account.
   *
   * @param rawToken - The verification token received by the user.
   * @returns The identifier of the account that was activated.
   * @throws AppError when the token is invalid, expired, already consumed,
   * or does not belong to an account awaiting verification.
   */
  async verifyEmail(rawToken: string): Promise<{ userId: string }> {
    if (!VERIFICATION_TOKEN_PATTERN.test(rawToken)) {
      throw this.createInvalidTokenError();
    }

    /* Hash the supplied token to match the value stored during registration. */
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const verifiedAt = this.now();

    /*
     * Claim the token atomically. Only one request can change consumedAt
     * from null, and expired or previously consumed tokens cannot be claimed.
     */
    const token = await VerificationTokenModel.findOneAndUpdate(
      {
        tokenHash,
        expiresAt: { $gt: verifiedAt },
        consumedAt: null,
      },
      {
        $set: { consumedAt: verifiedAt },
      },
      {
        returnDocument: 'after',
      },
    );

    if (!token) {
      throw this.createInvalidTokenError();
    }

    /*
     * Activate only an account that is still pending and has not already
     * been verified. The conditional update prevents repeated activation.
     */
    const user = await UserModel.findOneAndUpdate(
      {
        _id: token.userId,
        status: 'pending_verification',
        emailVerifiedAt: null,
        deletedAt: null,
      },
      {
        $set: {
          status: 'active',
          emailVerifiedAt: verifiedAt,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );

    if (!user) {
      throw this.createInvalidTokenError();
    }

    return {
      userId: user._id.toString(),
    };
  }

  /**
   * Creates a consistent error for unusable verification tokens.
   *
   * A generic message avoids revealing whether a token exists,
   * has expired, or has already been consumed.
   */
  private createInvalidTokenError(): AppError {
    return new AppError({
      statusCode: 400,
      code: 'VERIFICATION_TOKEN_INVALID',
      message: 'This verification link is invalid or has expired.',
    });
  }
}
