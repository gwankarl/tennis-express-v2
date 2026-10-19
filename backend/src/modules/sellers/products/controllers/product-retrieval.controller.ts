import type { RequestHandler } from 'express';

import { AppError } from '../../../../shared/errors/app-error.js';
import { productRetrievalService } from '../services/product-retrieval.service.js';

/* -------------------------------------------------------------------------- */
/* Product retrieval controller                                               */
/* -------------------------------------------------------------------------- */

/**
 * Retrieves the authenticated seller's product listings.
 */
export const getSellerProducts: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to retrieve products.',
      });
    }

    const page =
      req.query.page === undefined ? undefined : Number(req.query.page);

    const limit =
      req.query.limit === undefined ? undefined : Number(req.query.limit);

    const result = await productRetrievalService.getSellerProducts(sellerId, {
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves one product owned by the authenticated seller.
 */
export const getSellerProductById: RequestHandler = async (req, res, next) => {
  try {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to retrieve a product.',
      });
    }

    const product = await productRetrievalService.getSellerProductById(
      sellerId,
      String(req.params.productId),
    );

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
};
