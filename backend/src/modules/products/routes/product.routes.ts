import { Router } from 'express';

import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import { createRequireRole } from '../../auth/middleware/require-role.js';
import { validateRequest } from '../../../middleware/validate-request.js';
import type { AccessTokenService } from '../../auth/services/access-token.service.js';
import type { SessionService } from '../../auth/services/session.service.js';
import { createProduct } from '../controllers/product.controller.js';
import { submitProductForApproval } from '../controllers/product-submission.controller.js';
import { validateProductImageContent } from '../middleware/product-image-content-validation.middleware.js';
import { uploadProductImages } from '../middleware/product-image-upload.middleware.js';
import { createProductSchema } from '../validations/create-product.schema.js';
import { updateProductSchema } from '../validations/update-product.schema.js';
import { updateSellerProduct } from '../controllers/product-update.controller.js';
import {
  getSellerProductById,
  getSellerProducts,
} from '../controllers/product-retrieval.controller.js';

/* -------------------------------------------------------------------------- */
/* Product routes                                                             */
/* -------------------------------------------------------------------------- */

export interface ProductRouterDependencies {
  accessTokenService?: AccessTokenService;
  sessionService?: SessionService;
}

/**
 * Creates the product router with authentication and seller authorization.
 */
export function createProductRouter(
  dependencies: ProductRouterDependencies,
): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const requireSeller = createRequireRole(['seller']);

  router.post(
    '/',
    requireAuthentication,
    requireSeller,
    uploadProductImages,
    validateProductImageContent,
    validateRequest('body', createProductSchema),
    createProduct,
  );

  router.get('/mine', requireAuthentication, requireSeller, getSellerProducts);

  router.get(
    '/mine/:productId',
    requireAuthentication,
    requireSeller,
    getSellerProductById,
  );

  router.patch(
    '/mine/:productId',
    requireAuthentication,
    requireSeller,
    uploadProductImages,
    validateProductImageContent,
    validateRequest('body', updateProductSchema),
    updateSellerProduct,
  );

  router.post(
    '/mine/:productId/submit',
    requireAuthentication,
    requireSeller,
    submitProductForApproval,
  );

  return router;
}
