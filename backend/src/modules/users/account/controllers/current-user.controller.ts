import type { RequestHandler } from 'express';

import { AppError } from '../../../../shared/errors/app-error.js';
import { CurrentUserService } from '../services/current-user.service.js';

/** Creates a controller that returns the authenticated user's account. */
export function createCurrentUserController(): RequestHandler {
  const currentUserService = new CurrentUserService();

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
