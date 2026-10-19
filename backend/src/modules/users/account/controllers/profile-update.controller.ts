import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../../../shared/errors/app-error.js';
import type { ProfileUpdateService } from '../services/profile-update.service.js';
import type { ProfileUpdateRequest } from '../validations/profile-update.validation.js';

/** Creates the profile-update request handler. */
export function createProfileUpdateController(
  profileUpdateService: ProfileUpdateService,
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to update a profile.',
        });
      }

      const updates = req.body as ProfileUpdateRequest;

      const user = await profileUpdateService.updateProfile(
        req.auth.userId,
        updates,
      );

      res.status(200).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
