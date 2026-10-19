import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';

import { createSellerApplicationController } from '../controllers/seller-application.controller.js';

import { SellerApplicationService } from '../services/seller-application.service.js';

import { createSellerApplicationSchema } from '../validations/seller-application.validation.js';

import { CategoryCheckerService } from '../../../shared/categories/services/category-checker.service.js';

/** Creates authenticated seller application endpoints. */
export function createSellerApplicationsRouter(): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication();

  const categoryChecker = new CategoryCheckerService();

  const sellerApplicationService = new SellerApplicationService(
    categoryChecker,
  );

  const controller = createSellerApplicationController({
    sellerApplicationService,
  });

  router.post(
    '/',
    requireAuthentication,
    validateRequest('body', createSellerApplicationSchema),
    controller.submitApplication,
  );

  /* Register /me before /:applicationId to avoid treating "me" as an ID. */
  router.get('/me', requireAuthentication, controller.getLatestApplication);

  return router;
}

export default createSellerApplicationsRouter();
