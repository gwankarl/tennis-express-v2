import type { RequestHandler } from 'express';

import type { AuthTokenService } from '../services/auth-token.service.js';
import type { GoogleAuthService } from '../services/google-auth.service.js';

import {
  REFRESH_TOKEN_COOKIE_NAME,
  refreshCookieOptions,
} from '../../../config/auth-cookie.js';

/**
 * Creates the HTTP handler for Google authentication.
 *
 * Authenticates a Google identity, issues an application token pair,
 * and returns safe user information using the standard login response.
 */
export function createGoogleAuthController(
  googleAuthService: GoogleAuthService,
  authTokenService: AuthTokenService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await googleAuthService.authenticate(req.body.idToken);

      const tokens = await authTokenService.issueTokenPair({
        userId: result.user.id,
        roles: result.user.roles as ('buyer' | 'seller' | 'both' | 'admin')[],
      });

      res.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        tokens.refreshToken,
        refreshCookieOptions,
      );

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          tokens: {
            accessToken: tokens.accessToken,
            tokenType: 'Bearer',
            expiresIn: tokens.accessTokenExpiresIn,
          },
        },
      });
    } catch (error) {
      /* Delegate failures to the centralized error handler. */
      next(error);
    }
  };
}
