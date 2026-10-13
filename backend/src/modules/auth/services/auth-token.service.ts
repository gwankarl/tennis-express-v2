import type { UserRole } from '../../users/types/user.types.js';
import { AccessTokenService } from './access-token.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { SessionService } from './session.service.js';

import { AppError } from '../../../shared/errors/app-error.js';
import { UserModel } from '../../users/models/user.model.js';

/** User details required to issue an authentication token pair. */
export interface IssueTokenPairInput {
  userId: string;
  roles: UserRole[];
}

/** Tokens and session details returned after authentication. */
export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessTokenExpiresIn: number;
}

/** Coordinates session creation and authentication token issuance. */
export class AuthTokenService {
  constructor(
    private readonly accessTokenService = new AccessTokenService(),
    private readonly refreshTokenService = new RefreshTokenService(),
    private readonly sessionService = new SessionService(),
  ) {}

  /**
   * Creates a session and issues its access and refresh tokens.
   *
   * @param input - The authenticated user's identifier and roles.
   * @returns Both tokens and the session metadata needed by the client.
   */
  async issueTokenPair(input: IssueTokenPairInput): Promise<AuthTokenPair> {
    const generatedRefreshToken = this.refreshTokenService.generateToken();

    /* Refresh sessions last seven days; rotation will be handled separately. */
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.sessionService.createSession({
      userId: input.userId,
      expiresAt: refreshExpiresAt,
      refreshTokenHash: generatedRefreshToken.tokenHash,
    });

    const accessToken = this.accessTokenService.createToken({
      userId: input.userId,
      sessionId: session._id.toString(),
      roles: input.roles,
    });

    return {
      accessToken,
      refreshToken: generatedRefreshToken.token,
      sessionId: session._id.toString(),
      accessTokenExpiresIn: this.accessTokenService.getExpiresInSeconds(),
    };
  }

  /**
   * Validates and rotates a refresh token, then issues a new access token.
   *
   * @param token - The refresh token supplied by the client.
   * @returns The replacement tokens and existing session identifier.
   */
  async refreshToken(token: string): Promise<AuthTokenPair> {
    const currentTokenHash = this.refreshTokenService.hashToken(token);

    const session =
      await this.sessionService.findValidSessionByRefreshTokenHash(
        currentTokenHash,
      );

    if (!session) {
      throw new AppError({
        statusCode: 401,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'The refresh token is invalid or expired.',
      });
    }

    const user = await UserModel.findById(session.userId);

    if (
      !user ||
      user.status !== 'active' ||
      user.emailVerifiedAt === null ||
      user.deletedAt !== null
    ) {
      throw new AppError({
        statusCode: 403,
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'This account is not available for authentication.',
      });
    }

    const generatedRefreshToken = this.refreshTokenService.generateToken();

    const rotatedSession = await this.sessionService.rotateRefreshToken(
      currentTokenHash,
      generatedRefreshToken.tokenHash,
    );

    if (!rotatedSession) {
      throw new AppError({
        statusCode: 401,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'The refresh token is invalid or expired.',
      });
    }

    const accessToken = this.accessTokenService.createToken({
      userId: user._id.toString(),
      sessionId: rotatedSession._id.toString(),
      roles: user.roles,
    });

    return {
      accessToken,
      refreshToken: generatedRefreshToken.token,
      sessionId: rotatedSession._id.toString(),
      accessTokenExpiresIn: this.accessTokenService.getExpiresInSeconds(),
    };
  }
}
