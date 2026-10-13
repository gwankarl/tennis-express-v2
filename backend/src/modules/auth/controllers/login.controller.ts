import type { RequestHandler } from 'express';

import type { AuthTokenService } from '../services/auth-token.service.js';
import type { LoginService } from '../services/login.service.js';

/**
 * Creates the HTTP handler for user login.
 *
 * Authenticates the supplied credentials, issues a session and token pair,
 * and returns safe user information alongside the authentication tokens.
 *
 * @param loginService - Service responsible for credential verification.
 * @param authTokenService - Service responsible for issuing tokens and sessions.
 * @returns An Express handler that processes login requests.
 */
export function createLoginController(
  loginService: LoginService,
  authTokenService: AuthTokenService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await loginService.login(req.body);

      const tokens = await authTokenService.issueTokenPair({
        userId: result.user.id,
        roles: result.user.roles as ('buyer' | 'seller' | 'both' | 'admin')[],
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
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
