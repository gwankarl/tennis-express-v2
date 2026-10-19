import { Router } from 'express';

import { validateRequest } from '../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import type { RequireAuthenticationDependencies } from '../../auth/middleware/require-authentication.js';

import { createStoreManagementController } from '../controllers/store-management.controller.js';
import { StoreManagementService } from '../services/store-management.service.js';
import { createRequireRole } from '../../auth/middleware/require-role.js';

import {
  storeIdentityUpdateSchema,
  storeLocationUpdateSchema,
  storeDeliveryOptionsUpdateSchema,
  storeCollectionOptionsUpdateSchema,
  storeReturnPolicyUpdateSchema,
} from '../validations/store-management.validation.js';

import { uploadProfileImage } from '../../users/middleware/profile-image-upload.middleware.js';
import { validateProfileImageContent } from '../../users/middleware/profile-image-content-validation.middleware.js';

/** Dependencies required by the Store Management routes. */
export interface StoreManagementRouterDependencies extends RequireAuthenticationDependencies {
  storeManagementService?: StoreManagementService;
}

/** Creates authenticated routes for seller-owned store management operations. */
export function createStoreManagementRouter(
  dependencies: StoreManagementRouterDependencies = {},
): Router {
  const storeRouter = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const controller = createStoreManagementController(
    dependencies.storeManagementService ?? new StoreManagementService(),
  );

  const requireSeller = createRequireRole(['seller']);

  storeRouter.patch(
    '/identity',
    requireAuthentication,
    requireSeller,
    validateRequest('body', storeIdentityUpdateSchema),
    controller.updateStoreIdentity,
  );

  storeRouter.patch(
    '/location',
    requireAuthentication,
    requireSeller,
    validateRequest('body', storeLocationUpdateSchema),
    controller.updateStoreLocation,
  );

  storeRouter.post(
    '/logo',
    requireAuthentication,
    requireSeller,
    uploadProfileImage,
    validateProfileImageContent,
    controller.updateStoreLogo,
  );

  storeRouter.patch(
    '/delivery-options',
    requireAuthentication,
    requireSeller,
    validateRequest('body', storeDeliveryOptionsUpdateSchema),
    controller.updateStoreDeliveryOptions,
  );

  storeRouter.patch(
    '/collection-options',
    requireAuthentication,
    requireSeller,
    validateRequest('body', storeCollectionOptionsUpdateSchema),
    controller.updateStoreCollectionOptions,
  );

  storeRouter.patch(
    '/return-policy',
    requireAuthentication,
    requireSeller,
    validateRequest('body', storeReturnPolicyUpdateSchema),
    controller.updateStoreReturnPolicy,
  );

  return storeRouter;
}

export default createStoreManagementRouter();
