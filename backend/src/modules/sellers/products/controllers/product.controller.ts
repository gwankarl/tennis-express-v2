import type { RequestHandler } from 'express';

import { AppError } from '../../../../shared/errors/app-error.js';
import { productCreationService } from '../services/product-creation.service.js';

import type { CreateProductInput } from '../validations/create-product.schema.js';

/* -------------------------------------------------------------------------- */
/* Product controller                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Creates a product listing with its gallery images in one request.
 *
 * Authentication, seller authorization, multipart parsing, image-content
 * validation, and request-body validation are handled by route middleware.
 */
export const createProduct: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to create a product.',
      });
    }

    const input = req.body as CreateProductInput;
    const { primaryImageIndex, ...productInput } = input;

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];

    const imageFiles = uploadedFiles.map((file) => ({
      buffer: file.buffer,
      mimetype: file.mimetype,
    }));

    const product = await productCreationService.createProduct(
      sellerId,
      productInput,
      imageFiles,
      primaryImageIndex,
    );

    res.status(201).json({
      success: true,
      message: 'Product listing created successfully.',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};
