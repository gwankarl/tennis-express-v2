import { Router } from 'express';

import { getPublicProductById } from '../controllers/product-query.controller.js';

/**
 * Creates routes for public product queries.
 */
export function createProductQueryRouter(): Router {
  const productQueryRouter = Router();

  /* Retrieve a publicly visible product by its ID. */
  productQueryRouter.get('/:productId', getPublicProductById);

  return productQueryRouter;
}

/** Default router for public product queries. */
export default createProductQueryRouter();
