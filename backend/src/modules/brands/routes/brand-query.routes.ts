import { Router } from 'express';

import { createBrandQueryController } from '../controllers/brand-query.controller.js';

import type { BrandQueryControllerDependencies } from '../controllers/brand-query.controller.js';

/* -------------------------------------------------------------------------- */
/* Router dependencies                                                        */
/* -------------------------------------------------------------------------- */

export interface BrandQueryRouterDependencies extends BrandQueryControllerDependencies {}

/* -------------------------------------------------------------------------- */
/* Brand query router                                                         */
/* -------------------------------------------------------------------------- */

export function createBrandQueryRouter(
  dependencies: BrandQueryRouterDependencies = {},
): Router {
  const router = Router();

  const controller = createBrandQueryController(dependencies);

  router.get('/', controller.getBrands);

  return router;
}

export default createBrandQueryRouter();
