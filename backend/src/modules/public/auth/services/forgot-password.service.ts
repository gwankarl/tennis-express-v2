import { createHash, randomBytes } from 'node:crypto';

import { env } from '../../../../config/env.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { PasswordResetTokenModel } from '../models/password-reset-token.model.js';
import type { PasswordResetEmailSender } from '../types/registration.types.js';

export interface ForgotPasswordServiceDependencies {
  passwordResetEmailSender: PasswordResetEmailSender;
  tokenTtlSeconds?: number;
  now?: () => Date;
}

export class ForgotPasswordService {
  private readonly now: () => Date;
  private readonly tokenTtlSeconds: number;

  constructor(
    private readonly dependencies: ForgotPasswordServiceDependencies,
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.tokenTtlSeconds =
      dependencies.tokenTtlSeconds ?? env.passwordResetTokenTtlSeconds;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await UserModel.findOne({
      email: normalizedEmail,
      status: 'active',
      emailVerifiedAt: { $ne: null },
      deletedAt: null,
    }).select('+passwordHash');

    /* Do not disclose whether an account is eligible for recovery. */
    if (!user || !user.passwordHash) {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const createdAt = this.now();

    const newToken = await PasswordResetTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(createdAt.getTime() + this.tokenTtlSeconds * 1000),
    });

    try {
      await this.dependencies.passwordResetEmailSender.sendPasswordResetEmail({
        to: user.email,
        recipientName: `${user.profile.firstName} ${user.profile.lastName}`,
        token: rawToken,
      });
    } catch (error) {
      await PasswordResetTokenModel.deleteOne({ _id: newToken._id });
      throw error;
    }

    /* Invalidate older reset tokens only after the new email is accepted. */
    await PasswordResetTokenModel.deleteMany({
      userId: user._id,
      _id: { $ne: newToken._id },
    });
  }
}
