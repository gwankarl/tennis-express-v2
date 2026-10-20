import { Router } from 'express';

import {
  getNewListings,
  getPopularProducts,
  getPublicProductById,
  getPublicProducts,
  getRelatedProducts,
  recordProductView,
} from '../controllers/product-query.controller.js';

import { relatedProductsQuerySchema } from '../validations/related-products.validation.js';
import { validateRequest } from '../../../../middleware/validate-request.js';
import { productListingQuerySchema } from '../validations/product-listing.validation.js';
import { optionalAuthentication } from '../../../shared/auth/middleware/optional-authentication.js';

/**
 * Creates routes for public product queries.
 */
export function createProductQueryRouter(): Router {
  const productQueryRouter = Router();

  /* Retrieve a paginated list of publicly visible products. */
  productQueryRouter.get(
    '/',
    validateRequest('query', productListingQuerySchema),
    getPublicProducts,
  );

  /* Retrieve the newest publicly visible product listings. */
  productQueryRouter.get(
    '/new',
    validateRequest('query', productListingQuerySchema),
    getNewListings,
  );

  /* Retrieve related products for a publicly visible product. */
  productQueryRouter.get(
    '/:productId/related',
    validateRequest('query', relatedProductsQuerySchema),
    getRelatedProducts,
  );

  productQueryRouter.get('/popular', getPopularProducts);

  productQueryRouter.post(
    '/:productId/view',
    optionalAuthentication,
    recordProductView,
  );

  /* Retrieve a publicly visible product by its ID. */
  productQueryRouter.get('/:productId', getPublicProductById);

  return productQueryRouter;
}

/** Default router for public product queries. */
export default createProductQueryRouter();
