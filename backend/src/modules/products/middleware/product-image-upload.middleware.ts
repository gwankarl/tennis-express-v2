import multer from 'multer';
import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import {
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_IMAGE_MAX_FILES,
  PRODUCT_IMAGE_MAX_SIZE_BYTES,
} from '../validations/product-image.validation.js';

/**
 * Configures in-memory handling for product-gallery image uploads.
 */
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PRODUCT_IMAGE_MAX_SIZE_BYTES,
    files: PRODUCT_IMAGE_MAX_FILES,
  },
  fileFilter: (_req, file, callback) => {
    if (
      !PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(
        file.mimetype as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      callback(
        new AppError({
          statusCode: 400,
          code: 'INVALID_PRODUCT_IMAGE',
          message: 'Only JPEG, PNG, and WebP images are allowed.',
        }),
      );
      return;
    }

    callback(null, true);
  },
});

/**
 * Accepts multiple product images using the "images" field and converts
 * Multer upload-limit errors into appropriate client errors.
 */
export const uploadProductImages: RequestHandler = (req, res, next) => {
  productImageUpload.array('images', PRODUCT_IMAGE_MAX_FILES)(
    req,
    res,
    (error?: unknown) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(
            new AppError({
              statusCode: 413,
              code: 'PRODUCT_IMAGE_TOO_LARGE',
              message: 'Each product image must not exceed 5 MB.',
            }),
          );
          return;
        }

        if (error.code === 'LIMIT_FILE_COUNT') {
          next(
            new AppError({
              statusCode: 400,
              code: 'TOO_MANY_PRODUCT_IMAGES',
              message: 'A product can have at most 10 images.',
            }),
          );
          return;
        }

        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          next(
            new AppError({
              statusCode: 400,
              code: 'INVALID_PRODUCT_IMAGE_UPLOAD',
              message: 'Upload images using the "images" field.',
            }),
          );
          return;
        }
      }

      next(error);
    },
  );
};
