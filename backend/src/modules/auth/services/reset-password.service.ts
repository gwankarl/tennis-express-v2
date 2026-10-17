import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';
import { UserModel } from '../../users/models/user.model.js';
import { PasswordResetTokenModel } from '../models/password-reset-token.model.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { PwnedPasswordCompromiseChecker } from './pwned-password-compromise.checker.js';
import { SessionService } from './session.service.js';

export interface ResetPasswordServiceDependencies {
  passwordHasher?: Argon2PasswordHasher;
  passwordCompromiseChecker?: PwnedPasswordCompromiseChecker;
  sessionService?: SessionService;
  now?: () => Date;
}

export class ResetPasswordService {
  private readonly passwordHasher: Argon2PasswordHasher;
  private readonly passwordCompromiseChecker: PwnedPasswordCompromiseChecker;
  private readonly sessionService: SessionService;
  private readonly now: () => Date;

  constructor(dependencies: ResetPasswordServiceDependencies = {}) {
    this.passwordHasher =
      dependencies.passwordHasher ?? new Argon2PasswordHasher();
    this.passwordCompromiseChecker =
      dependencies.passwordCompromiseChecker ??
      new PwnedPasswordCompromiseChecker();
    this.sessionService = dependencies.sessionService ?? new SessionService();
    this.now = dependencies.now ?? (() => new Date());
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetToken = await PasswordResetTokenModel.findOne({
      tokenHash,
      expiresAt: { $gt: this.now() },
      consumedAt: null,
    });

    if (!resetToken) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
        message: 'The password-reset token is invalid or has expired.',
      });
    }

    const user = await UserModel.findOne({
      _id: resetToken.userId,
      status: 'active',
      emailVerifiedAt: { $ne: null },
      deletedAt: null,
    }).select('+passwordHash');

    if (!user) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
        message: 'The password-reset token is invalid or has expired.',
      });
    }

    const isCompromised =
      await this.passwordCompromiseChecker.isPasswordCompromised(newPassword);

    if (isCompromised) {
      throw new AppError({
        statusCode: 422,
        code: 'PASSWORD_COMPROMISED',
        message: 'Choose a different password.',
      });
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);

    await mongoose.connection.transaction(async (session) => {
      const consumedToken = await PasswordResetTokenModel.findOneAndUpdate(
        {
          _id: resetToken._id,
          tokenHash,
          expiresAt: { $gt: this.now() },
          consumedAt: null,
        },
        { $set: { consumedAt: this.now() } },

        { returnDocument: 'after', session },
      );

      if (!consumedToken) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
          message: 'The password-reset token is invalid or has expired.',
        });
      }

      const updatedUser = await UserModel.updateOne(
        {
          _id: user._id,
          status: 'active',
          deletedAt: null,
        },
        { $set: { passwordHash } },
        { session },
      );

      if (updatedUser.modifiedCount !== 1) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
          message: 'The password-reset token is invalid or has expired.',
        });
      }

      await PasswordResetTokenModel.deleteMany(
        { userId: user._id, _id: { $ne: resetToken._id } },
        { session },
      );

      await this.sessionService.revokeAllUserSessions(
        user._id.toString(),
        session,
      );
    });
  }
}
