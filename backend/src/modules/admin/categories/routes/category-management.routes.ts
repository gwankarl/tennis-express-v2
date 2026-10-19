import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';

import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';

import { createCategoryManagementController } from '../controllers/category-management.controller.js';

import {
  createCategorySchema,
  updateCategoryParamsSchema,
  updateCategorySchema,
} from '../validations/category.validation.js';

/** Creates administrator-only category management endpoints. */
export function createCategoryManagementRouter(): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication();

  const requireAdmin = createRequireRole(['admin']);

  const controller = createCategoryManagementController();

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
