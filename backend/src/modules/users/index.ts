import { Router } from 'express';

import { createUserAccountsRouter } from './account/routes/user-accounts.routes.js';

import { createSellerApplicationsRouter } from './seller-application/routes/seller-applications.routes.js';

/**
 * Creates the version 1 API router and registers its endpoints.
 *
 * @returns The configured router for API version 1.
 */
export function createV1UserRouter(): Router {
  const v1UserRouter = Router();

  /* Mount user-account endpoints under /users. */
  v1UserRouter.use('/acounts', createUserAccountsRouter());

  /* Mount authenticated users seller application endpoints. */
  v1UserRouter.use('/seller-applications', createSellerApplicationsRouter());

  return v1UserRouter;
}
