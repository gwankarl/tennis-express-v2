import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import { productUpdateService } from '../services/product-update.service.js';

import type { UpdateProductInput } from '../validations/update-product.schema.js';

/* -------------------------------------------------------------------------- */
/* Product update controller                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Updates a seller-owned product and optionally modifies its image gallery.
 */
export const updateSellerProduct: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to update a product.',
      });
    }

    const productId = String(req.params.productId);
    const input = req.body as UpdateProductInput;

    const { removeImagePublicIds, primaryImageIndex, ...fields } = input;

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];

    const imageFiles = uploadedFiles.map((file) => ({
      buffer: file.buffer,
      mimetype: file.mimetype,
    }));

    const product = await productUpdateService.updateSellerProduct(
      sellerId,
      productId,
      {
        fields,
        imageFiles,
        removeImagePublicIds,
        primaryImageIndex,
      },
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};
