import type { RequestHandler } from 'express';

import {
  clearRefreshCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../../../config/auth-cookie.js';
import type { AuthTokenService } from '../services/auth-token.service.js';

/** Creates a controller that revokes the current refresh-token session. */
export function createLogoutController(
  authTokenService: AuthTokenService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

      if (typeof refreshToken === 'string' && refreshToken.length > 0) {
        await authTokenService.revokeRefreshToken(refreshToken);
      }

      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearRefreshCookieOptions);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (error) {
      next(error);
    }
  };
}
