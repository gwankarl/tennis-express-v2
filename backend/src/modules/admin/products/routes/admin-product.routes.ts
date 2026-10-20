import { Router } from 'express';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';

import { getPendingProducts } from '../controllers/admin-product-retrieval.controller.js';
import { getAdminProductDetails } from '../controllers/admin-product-detail.controller.js';
import { approveAdminProduct } from '../controllers/admin-product-approval.controller.js';
import { rejectAdminProduct } from '../controllers/admin-product-rejection.controller.js';
/* -------------------------------------------------------------------------- */
/* Admin product routes                                                       */
/* -------------------------------------------------------------------------- */

/** Creates the admin product router with authentication and authorization. */
export function createAdminProductRouter(): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication();

  const requireAdmin = createRequireRole(['admin']);

  router.get(
    '/pending',
    requireAuthentication,
    requireAdmin,
    getPendingProducts,
  );

  router.get(
    '/:productId',
    requireAuthentication,
    requireAdmin,
    getAdminProductDetails,
  );

  router.patch(
    '/:productId/approve',
    requireAuthentication,
    requireAdmin,
    approveAdminProduct,
  );

  router.patch(
    '/:productId/reject',
    requireAuthentication,
    requireAdmin,
    rejectAdminProduct,
  );

  return router;
}
