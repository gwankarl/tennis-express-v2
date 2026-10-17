import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import type { ProfileImageUpdateService } from '../services/profile-image-update.service.js';

/** Creates the profile-image upload request handler. */
export function createProfileImageUploadController(
  profileImageUpdateService: ProfileImageUpdateService,
): RequestHandler {
  return async (req, res, next): Promise<void> => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to update a profile image.',
        });
      }

      if (!req.file) {
        throw new AppError({
          statusCode: 400,
          code: 'PROFILE_IMAGE_REQUIRED',
          message: 'A profile image file must be provided.',
        });
      }

      const user = await profileImageUpdateService.updateProfileImage(
        req.auth.userId,
        {
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
        },
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
