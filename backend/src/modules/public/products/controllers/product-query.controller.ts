import type { RequestHandler } from 'express';

import { productQueryService } from '../services/product-query.service.js';
import { productListingQuerySchema } from '../validations/product-listing.validation.js';
import { relatedProductsQuerySchema } from '../validations/related-products.validation.js';

import { productViewActivityService } from '../../../shared/products/services/product-view-activity.service.js';
import { popularProductsService } from '../services/popular-products.service.js';
import { popularProductsQuerySchema } from '../validations/popular-products.validation.js';

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

/**
 * Retrieves a paginated list of publicly visible products.
 */
export const getPublicProducts: RequestHandler = async (req, res, next) => {
  try {
    const query = productListingQuerySchema.parse(req.query);
    const result = await productQueryService.getPublicProducts(query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves related products for a publicly visible product.
 */
export const getRelatedProducts: RequestHandler = async (req, res, next) => {
  try {
    const query = relatedProductsQuerySchema.parse(req.query);

    const result = await productQueryService.getRelatedProducts(
      String(req.params.productId),
      query,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves the newest publicly visible product listings.
 */
export const getNewListings: RequestHandler = async (req, res, next) => {
  try {
    const query = productListingQuerySchema.parse(req.query);
    const result = await productQueryService.getNewListings(query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/** Retrieves the most-viewed publicly purchasable products from the last 30 days. */
export const getPopularProducts: RequestHandler = async (req, res, next) => {
  try {
    const query = popularProductsQuerySchema.parse(req.query);
    const result = await popularProductsService.getPopularProducts(query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/** Records a qualifying product view without exposing visitor identity. */
export const recordProductView: RequestHandler = async (req, res, next) => {
  try {
    const result = await productViewActivityService.recordView(
      String(req.params.productId),
      req,
      res,
      req.auth?.userId,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
