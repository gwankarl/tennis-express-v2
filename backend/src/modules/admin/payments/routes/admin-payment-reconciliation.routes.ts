import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';
import {
  getPaymentReconciliationQueue,
  reconcilePayment,
} from '../controllers/admin-payment-reconciliation.controller.js';
import {
  paymentReconciliationDecisionSchema,
  paymentReconciliationParamsSchema,
} from '../validations/payment-reconciliation.schema.js';

/** Creates administrator-only payment reconciliation endpoints. */
export function createAdminPaymentReconciliationRouter(): Router {
  const router = Router();

  const requireAuthentication = createRequireAuthentication();
  const requireAdmin = createRequireRole(['admin']);

  router.get(
    '/reconciliation',
    requireAuthentication,
    requireAdmin,
    getPaymentReconciliationQueue,
  );

  router.patch(
    '/:paymentId/reconcile',
    requireAuthentication,
    requireAdmin,
    validateRequest('params', paymentReconciliationParamsSchema),
    validateRequest('body', paymentReconciliationDecisionSchema),
    reconcilePayment,
  );

  return router;
}
