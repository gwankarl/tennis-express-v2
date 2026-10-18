import { Router } from 'express';

import { validateRequest } from '../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import type { RequireAuthenticationDependencies } from '../../auth/middleware/require-authentication.js';
import { createRequireRole } from '../../auth/middleware/require-role.js';

import { SellerApplicationService } from '../../sellers/services/seller-application.service.js';
import type { SellerApplicationReviewControllerDependencies } from '../controllers/seller-application-review.controller.js';
import { createSellerApplicationReviewController } from '../controllers/seller-application-review.controller.js';

import {
  rejectSellerApplicationSchema,
  sellerApplicationReviewParamsSchema,
} from '../validations/seller-application-review.validation.js';

import { CategoryCheckerService } from '../../categories/services/category-checker.service.js';

/** Dependencies required by the admin seller application review router. */
export interface AdminSellerApplicationReviewRouterDependencies
  extends
    RequireAuthenticationDependencies,
    Partial<SellerApplicationReviewControllerDependencies> {}

/** Creates administrator-only seller application review endpoints. */
export function createAdminSellerApplicationReviewRouter(
  dependencies: AdminSellerApplicationReviewRouterDependencies = {},
): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const requireAdmin = createRequireRole(['admin']);

  const sellerApplicationService =
    dependencies.sellerApplicationService ??
    new SellerApplicationService(new CategoryCheckerService());

  const controller = createSellerApplicationReviewController({
    sellerApplicationService,
  });

  router.patch(
    '/:applicationId/approve',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', sellerApplicationReviewParamsSchema),
    controller.approveApplication,
  );

  router.patch(
    '/:applicationId/reject',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', sellerApplicationReviewParamsSchema),
    validateRequest('body', rejectSellerApplicationSchema),
    controller.rejectApplication,
  );

  return router;
}

export default createAdminSellerApplicationReviewRouter();
