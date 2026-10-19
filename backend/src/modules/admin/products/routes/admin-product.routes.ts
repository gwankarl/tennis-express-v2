import { Router } from 'express';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';
import { getPendingProducts } from '../controllers/admin-product-retrieval.controller.js';

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

  return router;
}
