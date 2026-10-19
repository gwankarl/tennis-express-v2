import type { Request, Response } from 'express';

import {
  REFRESH_TOKEN_COOKIE_NAME,
  refreshCookieOptions,
} from '../../../../config/auth-cookie.js';
import { AuthTokenService } from '../services/auth-token.service.js';

/** Handles requests to refresh an authentication token pair. */
export class RefreshTokenController {
  constructor(private readonly authTokenService = new AuthTokenService()) {}

  /**
   * Rotates the refresh cookie and returns a new access token.
   */
  async refresh(req: Request, res: Response): Promise<Response> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_INVALID',
          message: 'A valid refresh token is required.',
        },
      });
    }

    const tokens = await this.authTokenService.refreshToken(refreshToken);

    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      refreshCookieOptions,
    );

    return res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        tokenType: 'Bearer',
        expiresIn: tokens.accessTokenExpiresIn,
      },
    });
  }
}
