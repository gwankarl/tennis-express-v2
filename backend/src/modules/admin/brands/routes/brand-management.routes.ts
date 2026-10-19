import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';

import { createBrandManagementController } from '../controllers/brand-management.controller.js';

import { createBrandStatusController } from '../controllers/brand-status.controller.js';

import {
  createBrandSchema,
  updateBrandParamsSchema,
  updateBrandSchema,
} from '../validations/brand.validation.js';

/* -------------------------------------------------------------------------- */
/* Brand management router                                                    */
/* -------------------------------------------------------------------------- */

export function createBrandManagementRouter(): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication();

  const requireAdmin = createRequireRole(['admin']);

  const managementController = createBrandManagementController();

  const statusController = createBrandStatusController();

  /* ------------------------------------------------------------------------ */
  /* Create a brand                                                           */
  /* ------------------------------------------------------------------------ */

  router.post(
    '/',
    requireAuthentication,
    requireAdmin,
    validateRequest('body', createBrandSchema),
    managementController.createBrand,
  );

  /* ------------------------------------------------------------------------ */
  /* Update brand details                                                     */
  /* ------------------------------------------------------------------------ */

  router.patch(
    '/:brandId',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', updateBrandParamsSchema),
    validateRequest('body', updateBrandSchema),
    managementController.updateBrand,
  );

  /* ------------------------------------------------------------------------ */
  /* Activate a brand                                                         */
  /* ------------------------------------------------------------------------ */

  router.patch(
    '/:brandId/activate',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', updateBrandParamsSchema),
    statusController.activateBrand,
  );

  /* ------------------------------------------------------------------------ */
  /* Deactivate a brand                                                       */
  /* ------------------------------------------------------------------------ */

  router.patch(
    '/:brandId/deactivate',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', updateBrandParamsSchema),
    statusController.deactivateBrand,
  );

  return router;
}

export default createBrandManagementRouter();
