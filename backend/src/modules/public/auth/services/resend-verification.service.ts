import { createHash, randomBytes } from 'node:crypto';

import { UserModel } from '../../../shared/users/models/user.model.js';
import { VerificationTokenModel } from '../models/verification-token.model.js';
import type { VerificationEmailSender } from '../types/registration.types.js';

/** Verification tokens remain valid for 24 hours. */
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Dependencies required to resend verification emails. */
export interface ResendVerificationServiceDependencies {
  /** Delivers verification emails through the existing email infrastructure. */
  verificationEmailSender: VerificationEmailSender;

  /** Supplies the current time to make expiration behavior testable. */
  now?: () => Date;
}

/**
 * Issues replacement verification tokens for pending accounts.
 *
 * Raw tokens are sent only through email. The database stores their
 * SHA-256 hashes, and previous tokens are invalidated after successful
 * email delivery.
 */
export class ResendVerificationService {
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: ResendVerificationServiceDependencies,
  ) {
    this.now = dependencies.now ?? (() => new Date());
  }

  /**
   * Sends a fresh verification email when the account is eligible.
   *
   * Unknown, deleted, already-verified, and otherwise ineligible accounts
   * produce the same successful result to avoid revealing account existence.
   *
   * @param email - Email address supplied by the requester.
   */
  async resendVerification(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await UserModel.findOne({
      email: normalizedEmail,
      status: 'pending_verification',
      emailVerifiedAt: null,
      deletedAt: null,
    });

    /* Do not reveal whether an account exists or needs verification. */
    if (!user) {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const createdAt = this.now();

    const newToken = await VerificationTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(createdAt.getTime() + VERIFICATION_TOKEN_TTL_MS),
    });

    try {
      await this.dependencies.verificationEmailSender.sendVerificationEmail({
        to: user.email,
        recipientName: `${user.profile.firstName} ${user.profile.lastName}`,
        token: rawToken,
      });
    } catch (error) {
      /*
       * Preserve existing tokens if email delivery fails, so a failed
       * resend does not unnecessarily invalidate a previously issued link.
       */
      await VerificationTokenModel.deleteOne({ _id: newToken._id });
      throw error;
    }

    /*
     * Invalidate older tokens only after the replacement email has been
     * accepted by the configured sender.
     */
    await VerificationTokenModel.deleteMany({
      userId: user._id,
      _id: { $ne: newToken._id },
    });
  }
}
