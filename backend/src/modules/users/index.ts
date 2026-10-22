import { Router } from 'express';

import { createUserAccountsRouter } from './account/routes/user-accounts.routes.js';
import { createSellerApplicationsRouter } from './seller-application/routes/seller-applications.routes.js';
import { createWishlistRouter } from './wishlist/routes/wishlist.routes.js';
import { createCartRouter } from './cart/routes/cart.routes.js';
import { createCheckoutSessionRouter } from './checkout/routes/checkout-session.routes.js';
import { createPaymentRouter } from './payments/routes/payment.routes.js';

/**
 * Creates the version 1 API router and registers its endpoints.
 *
 * @returns The configured router for API version 1.
 */
export function createV1UserRouter(): Router {
  const v1UserRouter = Router();

  /* Mount user-account endpoints. */
  v1UserRouter.use('/acounts', createUserAccountsRouter());

  /* Mount authenticated seller-application endpoints. */
  v1UserRouter.use('/seller-applications', createSellerApplicationsRouter());

  /* Mount authenticated wishlist endpoints. */
  v1UserRouter.use('/wishlist', createWishlistRouter());

  /* Mount authenticated cart endpoints. */
  v1UserRouter.use('/cart', createCartRouter());

  /* Mount authenticated checkout-session endpoints. */
  v1UserRouter.use('/checkout-sessions', createCheckoutSessionRouter());

  /* Mount authenticated customer payment endpoints. */
  v1UserRouter.use(createPaymentRouter());

  return v1UserRouter;
}
