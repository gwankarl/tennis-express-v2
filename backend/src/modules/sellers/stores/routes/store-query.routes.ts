import { Router } from 'express';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';
import { createStoreQueryController } from '../controllers/store-query.controller.js';

/** Creates routes for public store queries and authenticated owner queries. */
export function createStoreQueryRouter(): Router {
  const storeQueryRouter = Router();

  const controller = createStoreQueryController();
  const requireAuthentication = createRequireAuthentication();
  const requireSeller = createRequireRole(['seller']);

  /* Retrieve the authenticated seller's own store profile. */
  storeQueryRouter.get(
    '/me',
    requireAuthentication,
    requireSeller,
    controller.getMyStore,
  );

  return storeQueryRouter;
}

/** Default router for store queries. */
export default createStoreQueryRouter();
