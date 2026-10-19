import { Router } from 'express';

import type { RequireAuthenticationDependencies } from '../../../shared/auth/middleware/require-authentication.js';
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

  /* Retrieve a publicly visible store by its slug. */
  storeQueryRouter.get('/:slug', controller.getPublicStoreBySlug);

  return storeQueryRouter;
}

/** Default router for store queries. */
export default createStoreQueryRouter();
