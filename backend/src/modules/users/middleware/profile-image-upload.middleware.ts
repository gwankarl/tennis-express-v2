import multer from 'multer';
import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import {
  PROFILE_IMAGE_ALLOWED_MIME_TYPES,
  PROFILE_IMAGE_MAX_SIZE_BYTES,
} from '../validations/profile-image.validation.js';

/**
 * Configures in-memory handling for profile-image uploads.
 */
const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PROFILE_IMAGE_MAX_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (
      !PROFILE_IMAGE_ALLOWED_MIME_TYPES.includes(
        file.mimetype as (typeof PROFILE_IMAGE_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      callback(
        new AppError({
          statusCode: 400,
          code: 'INVALID_PROFILE_IMAGE',
          message: 'Only JPEG, PNG, and WebP images are allowed.',
        }),
      );
      return;
    }

    callback(null, true);
  },
});

/**
 * Accepts one image file and converts Multer size-limit errors into an
 * appropriate client error.
 */
export const uploadProfileImage: RequestHandler = (req, res, next) => {
  profileImageUpload.single('image')(req, res, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError({
            statusCode: 413,
            code: 'PROFILE_IMAGE_TOO_LARGE',
            message: 'The profile image must not exceed 5 MB.',
          }),
        );
        return;
      }

      if (
        error.code === 'LIMIT_FILE_COUNT' ||
        error.code === 'LIMIT_UNEXPECTED_FILE'
      ) {
        next(
          new AppError({
            statusCode: 400,
            code: 'INVALID_PROFILE_IMAGE_UPLOAD',
            message: 'Upload exactly one file using the "image" field.',
          }),
        );
        return;
      }
    }

    next(error);
  });
};
