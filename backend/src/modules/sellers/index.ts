import { Router } from 'express';

import { createProductRouter } from './products/routes/product.routes.js';
import { createStoreManagementRouter } from './stores/routes/store-management.routes.js';
import { createStoreQueryRouter } from './stores/routes/store-query.routes.js';
import { createSellerOrderPaymentRouter } from './orders/routes/seller-order-payment.routes.js';

/**
 * Creates the version 1 API router and registers its endpoints.
 *
 * @returns The configured router for API version 1.
 */
export function createV1SellerRouter(): Router {
  const v1SellerRouter = Router();

  /* Mount authenticated seller product-creation endpoints. */
  v1SellerRouter.use('/products', createProductRouter());

  /* Mount authenticated seller store-management endpoints. */
  v1SellerRouter.use('/stores', createStoreManagementRouter());

  /* Mount public store profile retrieval endpoints. */
  v1SellerRouter.use('/stores', createStoreQueryRouter());

  /* Mount seller order payment-declaration endpoints. */
  v1SellerRouter.use('/orders', createSellerOrderPaymentRouter());

  return v1SellerRouter;
}
