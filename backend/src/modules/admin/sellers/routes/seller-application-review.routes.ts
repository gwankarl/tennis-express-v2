import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';

import { SellerApplicationService } from '../services/admin-seller-application.service.js';
import { createSellerApplicationReviewController } from '../controllers/seller-application-review.controller.js';

import {
  applicationIdParamsSchema,
  rejectSellerApplicationSchema,
  sellerApplicationReviewParamsSchema,
} from '../validations/seller-application-review.validation.js';

/** Creates administrator-only seller application review endpoints. */
export function createAdminSellerApplicationReviewRouter(): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication();

  const requireAdmin = createRequireRole(['admin']);

  const sellerApplicationService = new SellerApplicationService();

  const controller = createSellerApplicationReviewController({
    sellerApplicationService,
  });

  router.get(
    '/:applicationId',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', applicationIdParamsSchema),
    controller.getApplicationById,
  );

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
