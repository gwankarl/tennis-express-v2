import { createHash, randomBytes } from 'node:crypto';

import { AppError } from '../../../shared/errors/app-error.js';
import { UserModel } from '../../users/models/user.model.js';
import { VerificationTokenModel } from '../models/verification-token.model.js';
import type {
  PasswordCompromiseChecker,
  PasswordHasher,
  RegistrationInput,
  RegistrationResult,
  VerificationEmailSender,
} from '../types/registration.types.js';

/** Email-verification tokens remain valid for 24 hours. */
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Dependencies required to execute the registration workflow. */
export interface RegistrationServiceDependencies {
  passwordHasher: PasswordHasher;
  passwordCompromiseChecker: PasswordCompromiseChecker;
  verificationEmailSender: VerificationEmailSender;
}

/**
 * Registers a buyer account and initiates email verification.
 *
 * Password security and email delivery are delegated to injected services
 * so they can be replaced or mocked independently.
 */
export class RegistrationService {
  constructor(private readonly dependencies: RegistrationServiceDependencies) {}

  /**
   * Creates a pending account, persists a verification token, and sends
   * verification instructions to the supplied email address.
   *
   * @param input - Validated registration details.
   * @returns A safe summary of the newly created account.
   * @throws AppError when the email is already registered or the password
   * is known to be compromised.
   */
  async register(input: RegistrationInput): Promise<RegistrationResult> {
    const { firstName, lastName, email, password } = input;

    /* Check for an existing account before performing expensive operations. */
    const existingUser = await UserModel.exists({ email });
    if (existingUser) {
      throw new AppError({
        statusCode: 409,
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Unable to complete registration.',
      });
    }

    /* Reject compromised passwords before hashing or creating an account. */
    const isCompromised =
      await this.dependencies.passwordCompromiseChecker.isPasswordCompromised(
        password,
      );

    if (isCompromised) {
      throw new AppError({
        statusCode: 422,
        code: 'PASSWORD_COMPROMISED',
        message: 'Choose a different password.',
      });
    }

    /* Persist only the password hash, never the original password. */
    const passwordHash = await this.dependencies.passwordHasher.hash(password);

    const user = await UserModel.create({
      email,
      passwordHash,
      roles: ['buyer'],
      status: 'pending_verification',
      profile: {
        firstName,
        lastName,
      },
    });

    /* Generate a cryptographically secure token and store only its hash. */
    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    try {
      await VerificationTokenModel.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      });
    } catch (error) {
      /*
       * Remove the newly created account if its verification token
       * cannot be persisted, avoiding an incomplete registration.
       */
      await UserModel.deleteOne({ _id: user._id });
      throw error;
    }

    /*
     * Deliver the raw token only through the verification email.
     * If delivery fails, retain the pending account and token so the
     * user can use the verification-resend workflow later.
     */
    await this.dependencies.verificationEmailSender.sendVerificationEmail({
      to: user.email,
      recipientName: `${firstName} ${lastName}`,
      token: verificationToken,
    });

    /* Return only fields intended for application-level use. */
    return {
      user: {
        id: user._id.toString(),
        firstName,
        lastName,
        email: user.email,
        status: user.status,
      },
    };
  }
}
