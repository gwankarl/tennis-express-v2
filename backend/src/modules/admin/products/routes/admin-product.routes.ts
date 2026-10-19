import { Router } from 'express';

import { createRequireAuthentication } from '../../../auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../auth/middleware/require-role.js';
import type { AccessTokenService } from '../../../auth/services/access-token.service.js';
import type { SessionService } from '../../../auth/services/session.service.js';
import { getPendingProducts } from '../controllers/admin-product-retrieval.controller.js';

/* -------------------------------------------------------------------------- */
/* Admin product routes                                                       */
/* -------------------------------------------------------------------------- */

export interface AdminProductRouterDependencies {
  accessTokenService?: AccessTokenService;
  sessionService?: SessionService;
}

/** Creates the admin product router with authentication and authorization. */
export function createAdminProductRouter(
  dependencies: AdminProductRouterDependencies,
): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const requireAdmin = createRequireRole(['admin']);

  router.get(
    '/pending',
    requireAuthentication,
    requireAdmin,
    getPendingProducts,
  );

  return router;
}
