import type { RequestHandler } from 'express';

import { productQueryService } from '../services/product-query.service.js';

/**
 * Retrieves a publicly visible product by its ID.
 */
export const getPublicProductById: RequestHandler = async (req, res, next) => {
  try {
    const product = await productQueryService.getPublicProductById(
      String(req.params.productId),
    );

    res.status(200).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};
