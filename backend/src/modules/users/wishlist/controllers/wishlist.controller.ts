import type { RequestHandler } from 'express';

import { wishlistService } from '../services/wishlist.service.js';
import { wishlistQuerySchema } from '../validations/wishlist.validation.js';

/** Saves a product to the authenticated customer's wishlist. */
export const addWishlistProduct: RequestHandler = async (req, res, next) => {
  try {
    const result = await wishlistService.addProduct(
      req.auth!.userId,
      String(req.params.productId),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/** Retrieves the authenticated customer's paginated wishlist. */
export const getWishlist: RequestHandler = async (req, res, next) => {
  try {
    const query = wishlistQuerySchema.parse(req.query);
    const result = await wishlistService.getWishlist(req.auth!.userId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/** Removes a product from the authenticated customer's wishlist. */
export const removeWishlistProduct: RequestHandler = async (req, res, next) => {
  try {
    const result = await wishlistService.removeProduct(
      req.auth!.userId,
      String(req.params.productId),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
