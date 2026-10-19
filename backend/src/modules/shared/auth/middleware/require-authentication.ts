import type { RequestHandler } from 'express';

import { AccessTokenService } from '../services/access-token.service.js';
import { SessionService } from '../services/session.service.js';
import { AppError } from '../../../../shared/errors/app-error.js';

/** Dependencies required to authenticate an incoming request. */
export interface RequireAuthenticationDependencies {
  accessTokenService?: AccessTokenService;
  sessionService?: SessionService;
}

/** Creates middleware that verifies an access token and its session. */
export function createRequireAuthentication(
  dependencies: RequireAuthenticationDependencies = {},
): RequestHandler {
  const accessTokenService =
    dependencies.accessTokenService ?? new AccessTokenService();

  const sessionService = dependencies.sessionService ?? new SessionService();

  return async (req, _res, next) => {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      next(
        new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        }),
      );
      return;
    }

    const claims = accessTokenService.verifyToken(match[1]);

    if (!claims) {
      next(
        new AppError({
          statusCode: 401,
          code: 'INVALID_ACCESS_TOKEN',
          message: 'The access token is invalid or has expired.',
        }),
      );
      return;
    }

    try {
      const session = await sessionService.findValidSession(claims.sessionId);

      if (!session || session.userId.toString() !== claims.userId) {
        next(
          new AppError({
            statusCode: 401,
            code: 'INVALID_SESSION',
            message: 'The authenticated session is no longer valid.',
          }),
        );
        return;
      }

      req.auth = {
        userId: claims.userId,
        sessionId: claims.sessionId,
        roles: claims.roles,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
