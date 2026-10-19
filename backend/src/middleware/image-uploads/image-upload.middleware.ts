import multer from 'multer';
import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error.js';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_MAX_SIZE_BYTES,
} from '../../validations/image-upload.validation.js';

/**
 * Configures in-memory handling for image uploads.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: IMAGE_MAX_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (
      !ALLOWED_IMAGE_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
      )
    ) {
      callback(
        new AppError({
          statusCode: 400,
          code: 'INVALID_IMAGE',
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
export const uploadImage: RequestHandler = (req, res, next) => {
  imageUpload.single('image')(req, res, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError({
            statusCode: 413,
            code: 'IMAGE_TOO_LARGE',
            message: 'The image must not exceed 5 MB.',
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
            code: 'INVALID_IMAGE_UPLOAD',
            message: 'Upload exactly one file using the "image" field.',
          }),
        );
        return;
      }
    }

    next(error);
  });
};
