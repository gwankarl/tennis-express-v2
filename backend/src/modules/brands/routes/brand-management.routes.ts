import { Router } from 'express';

import { validateRequest } from '../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import type { RequireAuthenticationDependencies } from '../../auth/middleware/require-authentication.js';
import { createRequireRole } from '../../auth/middleware/require-role.js';

import { createBrandManagementController } from '../controllers/brand-management.controller.js';
import type { BrandManagementControllerDependencies } from '../controllers/brand-management.controller.js';

import { createBrandStatusController } from '../controllers/brand-status.controller.js';
import type { BrandStatusControllerDependencies } from '../controllers/brand-status.controller.js';

import {
  createBrandSchema,
  updateBrandParamsSchema,
  updateBrandSchema,
} from '../validations/brand.validation.js';

/* -------------------------------------------------------------------------- */
/* Router dependencies                                                        */
/* -------------------------------------------------------------------------- */

export interface BrandManagementRouterDependencies
  extends
    RequireAuthenticationDependencies,
    Partial<BrandManagementControllerDependencies>,
    Partial<BrandStatusControllerDependencies> {}

/* -------------------------------------------------------------------------- */
/* Brand management router                                                    */
/* -------------------------------------------------------------------------- */

export function createBrandManagementRouter(
  dependencies: BrandManagementRouterDependencies = {},
): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const requireAdmin = createRequireRole(['admin']);

  const managementController = createBrandManagementController({
    brandManagementService: dependencies.brandManagementService,
  });

  const statusController = createBrandStatusController({
    brandStatusService: dependencies.brandStatusService,
  });

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
