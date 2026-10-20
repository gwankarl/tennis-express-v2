import type { RequestHandler } from 'express';

import { AppError } from '../../../../shared/errors/app-error.js';
import { productVariantService } from '../services/product-variant.service.js';

import type {
  CreateProductVariantInput,
  UpdateProductVariantInput,
  UpdateProductVariantStatusInput,
} from '../validations/variants/product-variant.schema.js';

/* -------------------------------------------------------------------------- */
/* Product variant controller                                                 */
/* -------------------------------------------------------------------------- */

/** Creates a variant for a seller-owned product. */
export const createProductVariant: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to create a product variant.',
      });
    }

    const variant = await productVariantService.createVariant(
      sellerId,
      String(req.params.productId),
      req.body as CreateProductVariantInput,
    );

    res.status(201).json({
      success: true,
      message: 'Product variant created successfully.',
      data: { variant },
    });
  } catch (error) {
    next(error);
  }
};

/** Retrieves variants for a seller-owned product. */
export const getProductVariants: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to retrieve product variants.',
      });
    }

    const variants = await productVariantService.getVariants(
      sellerId,
      String(req.params.productId),
    );

    res.status(200).json({
      success: true,
      data: { variants },
    });
  } catch (error) {
    next(error);
  }
};

/** Updates a seller-owned product variant. */
export const updateProductVariant: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to update a product variant.',
      });
    }

    const variant = await productVariantService.updateVariant(
      sellerId,
      String(req.params.productId),
      String(req.params.variantId),
      req.body as UpdateProductVariantInput,
    );

    res.status(200).json({
      success: true,
      message: 'Product variant updated successfully.',
      data: { variant },
    });
  } catch (error) {
    next(error);
  }
};

/** Activates or deactivates a seller-owned product variant. */
export const updateProductVariantStatus: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to change variant status.',
      });
    }

    const input = req.body as UpdateProductVariantStatusInput;

    const variant = await productVariantService.updateVariantStatus(
      sellerId,
      String(req.params.productId),
      String(req.params.variantId),
      input.status,
    );

    res.status(200).json({
      success: true,
      message: 'Product variant status updated successfully.',
      data: { variant },
    });
  } catch (error) {
    next(error);
  }
};
