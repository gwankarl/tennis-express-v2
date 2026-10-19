import { fileTypeFromBuffer } from 'file-type';
import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import { PRODUCT_IMAGE_ALLOWED_MIME_TYPES } from '../validations/product-image.validation.js';

/**
 * Verifies that each uploaded file's binary signature matches an allowed
 * image format and agrees with the MIME type declared by the client.
 */
export const validateProductImageContent: RequestHandler = async (
  req,
  _res,
  next,
): Promise<void> => {
  try {
    const files = req.files;

    if (!Array.isArray(files) || files.length === 0) {
      next();
      return;
    }

    for (const file of files) {
      const detectedType = await fileTypeFromBuffer(file.buffer);

      const isAllowedType =
        detectedType !== undefined &&
        PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(
          detectedType.mime as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
        );

      if (!isAllowedType || detectedType.mime !== file.mimetype) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_PRODUCT_IMAGE',
          message:
            'Every uploaded file must be a valid JPEG, PNG, or WebP image.',
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
