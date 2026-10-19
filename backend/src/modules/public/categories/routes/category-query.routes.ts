import { Router } from 'express';

import { createCategoryQueryController } from '../controllers/category-query.controller.js';
import type { CategoryQueryControllerDependencies } from '../controllers/category-query.controller.js';

/** Dependencies required by the public category query router. */
export interface CategoryQueryRouterDependencies extends CategoryQueryControllerDependencies {}

/** Creates public category retrieval endpoints. */
export function createCategoryQueryRouter(
  dependencies: CategoryQueryRouterDependencies = {},
): Router {
  const router = Router();

  const controller = createCategoryQueryController(dependencies);

  router.get('/', controller.getCategories);

  return router;
}

export default createCategoryQueryRouter();
