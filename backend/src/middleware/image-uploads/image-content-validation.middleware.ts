import { fileTypeFromBuffer } from 'file-type';
import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error.js';
import { ALLOWED_IMAGE_MIME_TYPES } from '../../validations/image-upload.validation.js';

/**
 * Verifies that the uploaded file's binary signature matches an allowed image
 * format and agrees with the MIME type declared by the client.
 */
export const validateImageContent: RequestHandler = async (
  req,
  _res,
  next,
): Promise<void> => {
  try {
    if (!req.file) {
      next();
      return;
    }

    const detectedType = await fileTypeFromBuffer(req.file.buffer);

    const isAllowedType =
      detectedType !== undefined &&
      ALLOWED_IMAGE_MIME_TYPES.includes(
        detectedType.mime as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
      );

    if (!isAllowedType || detectedType.mime !== req.file.mimetype) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PROFILE_IMAGE',
        message: 'The uploaded file must be a valid JPEG, PNG, or WebP image.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
