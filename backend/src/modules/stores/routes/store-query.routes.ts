import { Router } from 'express';

import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import type { RequireAuthenticationDependencies } from '../../auth/middleware/require-authentication.js';
import { createRequireRole } from '../../auth/middleware/require-role.js';
import { createStoreQueryController } from '../controllers/store-query.controller.js';
import type { StoreQueryControllerDependencies } from '../controllers/store-query.controller.js';

/** Dependencies used to construct the store query router. */
export interface StoreQueryRouterDependencies
  extends RequireAuthenticationDependencies, StoreQueryControllerDependencies {}

/** Creates routes for public store queries and authenticated owner queries. */
export function createStoreQueryRouter(
  dependencies: StoreQueryRouterDependencies = {},
): Router {
  const storeQueryRouter = Router();

  const controller = createStoreQueryController(dependencies);
  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });
  const requireSeller = createRequireRole(['seller']);

  /* Retrieve the authenticated seller's own store profile. */
  storeQueryRouter.get(
    '/me',
    requireAuthentication,
    requireSeller,
    controller.getMyStore,
  );

  /* Retrieve a publicly visible store by its slug. */
  storeQueryRouter.get('/:slug', controller.getPublicStoreBySlug);

  return storeQueryRouter;
}

/** Default router for store queries. */
export default createStoreQueryRouter();
