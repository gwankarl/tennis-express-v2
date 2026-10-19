import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';

import { createStoreManagementController } from '../controllers/store-management.controller.js';
import { StoreManagementService } from '../services/store-management.service.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';

import {
  storeIdentityUpdateSchema,
  storeLocationUpdateSchema,
  storeDeliveryOptionsUpdateSchema,
  storeCollectionOptionsUpdateSchema,
  storeReturnPolicyUpdateSchema,
} from '../validations/store-management.validation.js';

import { uploadImage } from '../../../../middleware/image-uploads/image-upload.middleware.js';
import { validateImageContent } from '../../../../middleware/image-uploads/image-content-validation.middleware.js';

/** Creates authenticated routes for seller-owned store management operations. */
export function createStoreManagementRouter(): Router {
  const storeRouter = Router();

  const requireAuthentication = createRequireAuthentication();

  const controller = createStoreManagementController(
    new StoreManagementService(),
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
    uploadImage,
    validateImageContent,
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
