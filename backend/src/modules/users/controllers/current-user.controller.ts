import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import { CurrentUserService } from '../services/current-user.service.js';

/** Dependencies required by the current-user controller. */
export interface CurrentUserControllerDependencies {
  currentUserService?: CurrentUserService;
}

/** Creates a controller that returns the authenticated user's account. */
export function createCurrentUserController(
  dependencies: CurrentUserControllerDependencies = {},
): RequestHandler {
  const currentUserService =
    dependencies.currentUserService ?? new CurrentUserService();

  return async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const user = await currentUserService.getCurrentUser(req.auth.userId);

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  };
}
