import { AppError } from '../../../shared/errors/app-error.js';
import { UserModel } from '../../users/models/user.model.js';

/** Verified identity claims extracted from a Google ID token. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  name?: string;
}

/** Verifies a Google ID token and returns its trusted identity claims. */
export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity | null>;
}

/** Dependencies required by Google authentication. */
export interface GoogleAuthServiceDependencies {
  tokenVerifier: GoogleTokenVerifier;
}

/** Safe account information returned after successful authentication. */
export interface GoogleAuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    status: string;
  };
}

/**
 * Authenticates users through a verified Google identity.
 *
 * Token issuance and session creation are handled by the authentication
 * controller after this service returns successfully.
 */
export class GoogleAuthService {
  constructor(private readonly dependencies: GoogleAuthServiceDependencies) {}

  /**
   * Verifies a Google identity and authenticates or creates its account.
   *
   * Existing accounts are never linked automatically by matching email.
   *
   * @param idToken - ID token received from Google Identity Services.
   * @returns A safe summary of the authenticated user.
   */
  async authenticate(idToken: string): Promise<GoogleAuthResult> {
    let identity: GoogleIdentity | null;

    try {
      identity = await this.dependencies.tokenVerifier.verify(idToken);
    } catch {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'The Google sign-in token is invalid or expired.',
      });
    }

    if (!identity?.sub || !identity.email?.trim()) {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'The Google sign-in token is invalid.',
      });
    }

    if (!identity.emailVerified) {
      throw new AppError({
        statusCode: 403,
        code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        message: 'Verify your Google email address before signing in.',
      });
    }

    const googleId = identity.sub;
    const email = identity.email.trim().toLowerCase();

    /* Find an account already associated with this Google identity. */
    const linkedUser = await UserModel.findOne({ googleId }).select(
      '+googleId',
    );

    if (linkedUser) {
      if (linkedUser.deletedAt || linkedUser.status !== 'active') {
        throw this.accountUnavailableError();
      }

      if (!linkedUser.emailVerifiedAt) {
        throw new AppError({
          statusCode: 403,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before signing in.',
        });
      }

      return this.recordSuccessfulLogin(linkedUser);
    }

    /* Never attach a Google identity to an existing account automatically. */
    const existingUser = await UserModel.findOne({ email }).select('+googleId');

    if (existingUser) {
      if (existingUser.deletedAt || existingUser.status !== 'active') {
        throw this.accountUnavailableError();
      }

      throw new AppError({
        statusCode: 409,
        code: 'ACCOUNT_LINK_REQUIRED',
        message:
          'An account with this email already exists. Sign in using your existing method.',
      });
    }

    /* Google-verified email addresses can start with a verified buyer account. */
    const fullName = identity.name?.trim();
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const emailName = email.split('@')[0] || 'Google';

    const firstName = identity.givenName?.trim() || nameParts[0] || emailName;
    const lastName =
      identity.familyName?.trim() || nameParts.slice(1).join(' ') || 'User';

    const now = new Date();

    const newUser = await UserModel.create({
      email,
      googleId,
      emailVerifiedAt: now,
      roles: ['buyer'],
      status: 'active',
      profile: {
        firstName,
        lastName,
      },
      lastLoginAt: now,
    });

    return {
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        firstName: newUser.profile.firstName,
        lastName: newUser.profile.lastName,
        roles: newUser.roles,
        status: newUser.status,
      },
    };
  }

  /**
   * Records a successful login only while the account remains eligible.
   */
  private async recordSuccessfulLogin(
    user: NonNullable<Awaited<ReturnType<typeof UserModel.findOne>>>,
  ): Promise<GoogleAuthResult> {
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
      throw this.accountUnavailableError();
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

  private accountUnavailableError(): AppError {
    return new AppError({
      statusCode: 403,
      code: 'ACCOUNT_UNAVAILABLE',
      message: 'This account is not available for sign-in.',
    });
  }
}
