import { Router } from 'express';

import { validateRequest } from '../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import type { RequireAuthenticationDependencies } from '../../auth/middleware/require-authentication.js';
import { createRequireRole } from '../../auth/middleware/require-role.js';

import { createCategoryManagementController } from '../controllers/category-management.controller.js';
import type { CategoryManagementControllerDependencies } from '../controllers/category-management.controller.js';

import {
  createCategorySchema,
  updateCategoryParamsSchema,
  updateCategorySchema,
} from '../validations/category.validation.js';

/** Dependencies required by the category management router. */
export interface CategoryManagementRouterDependencies
  extends
    RequireAuthenticationDependencies,
    Partial<CategoryManagementControllerDependencies> {}

/** Creates administrator-only category management endpoints. */
export function createCategoryManagementRouter(
  dependencies: CategoryManagementRouterDependencies = {},
): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const requireAdmin = createRequireRole(['admin']);

  const controller = createCategoryManagementController({
    categoryManagementService: dependencies.categoryManagementService,
  });

  router.post(
    '/',
    requireAuthentication,
    requireAdmin,
    validateRequest('body', createCategorySchema),
    controller.createCategory,
  );

  router.patch(
    '/:categoryId',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', updateCategoryParamsSchema),
    validateRequest('body', updateCategorySchema),
    controller.updateCategory,
  );

  return router;
}

export default createCategoryManagementRouter();
