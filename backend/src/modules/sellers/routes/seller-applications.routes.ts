import { Router } from 'express';
import { z } from 'zod';

import { validateRequest } from '../../../middleware/validate-request.js';

import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import type { RequireAuthenticationDependencies } from '../../auth/middleware/require-authentication.js';

import { createSellerApplicationController } from '../controllers/seller-application.controller.js';
import type { SellerApplicationControllerDependencies } from '../controllers/seller-application.controller.js';

import { SellerApplicationService } from '../services/seller-application.service.js';
import type { SellerApplicationCategoryChecker } from '../services/seller-application.service.js';

import { createSellerApplicationSchema } from '../validations/seller-application.validation.js';

import { CategoryCheckerService } from '../../categories/services/category-checker.service.js';

/** Dependencies required by the seller applications router. */
export interface SellerApplicationsRouterDependencies
  extends
    RequireAuthenticationDependencies,
    Partial<SellerApplicationControllerDependencies> {
  categoryChecker?: SellerApplicationCategoryChecker;
}

/** Validates the seller application identifier route parameter. */
const applicationIdParamsSchema = z
  .object({
    applicationId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid application ID.'),
  })
  .strict();

/** Creates authenticated seller application endpoints. */
export function createSellerApplicationsRouter(
  dependencies: SellerApplicationsRouterDependencies = {},
): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const categoryChecker =
    dependencies.categoryChecker ?? new CategoryCheckerService();

  const sellerApplicationService =
    dependencies.sellerApplicationService ??
    new SellerApplicationService(categoryChecker);

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

  router.get(
    '/:applicationId',
    requireAuthentication,
    validateRequest('params', applicationIdParamsSchema),
    controller.getApplicationById,
  );

  return router;
}

export default createSellerApplicationsRouter();
