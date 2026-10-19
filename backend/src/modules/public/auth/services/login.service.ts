import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import type { PasswordHasher } from '../types/registration.types.js';

/** Input required to authenticate an existing account. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Safe account information returned after successful authentication. */
export interface LoginResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    status: string;
  };
}

/** Dependencies required to authenticate an account. */
export interface LoginServiceDependencies {
  passwordHasher: PasswordHasher;
}

/**
 * Authenticates users with password-based credentials.
 *
 * Session creation and token issuance are handled by subsequent
 * authentication tasks.
 */
export class LoginService {
  constructor(private readonly dependencies: LoginServiceDependencies) {}

  /**
   * Verifies credentials and checks account eligibility.
   *
   * @param input - Validated login credentials.
   * @returns A safe summary of the authenticated user.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();

    /* Include the password hash explicitly because the model hides it by default. */
    const user = await UserModel.findOne({
      email,
      deletedAt: null,
    }).select('+passwordHash');

    /* Use the same error for unknown emails and incorrect passwords. */
    if (
      !user ||
      !user.passwordHash ||
      !(await this.dependencies.passwordHasher.verify(
        input.password,
        user.passwordHash,
      ))
    ) {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    if (user.status === 'pending_verification' || !user.emailVerifiedAt) {
      throw new AppError({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before signing in.',
      });
    }

    if (user.status !== 'active') {
      throw new AppError({
        statusCode: 403,
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'This account is not available for sign-in.',
      });
    }

    /* Recheck eligibility when recording the successful login. */
    const updateResult = await UserModel.updateOne(
      {
        _id: user._id,
        status: 'active',
        emailVerifiedAt: { $ne: null },
        deletedAt: null,
      },
      { $set: { lastLoginAt: new Date() } },
    );

    if (updateResult.modifiedCount !== 1) {
      throw new AppError({
        statusCode: 403,
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'This account is not available for sign-in.',
      });
    }

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        roles: user.roles,
        status: user.status,
      },
    };
  }
}
