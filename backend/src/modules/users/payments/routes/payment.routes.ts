import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import {
  createIntegratedPayment,
  getPaymentStatus,
} from '../controllers/payment.controller.js';
import { createIntegratedPaymentSchema } from '../validations/create-integrated-payment.schema.js';
import { paymentStatusParamsSchema } from '../validations/payment-status-params.schema.js';
import { checkoutSessionParamsSchema } from '../../checkout/validations/checkout-session-params.schema.js';

/** Creates authenticated payment endpoints for customer checkouts. */
export function createPaymentRouter(): Router {
  const router = Router();

  router.use(createRequireAuthentication());

  router.post(
    '/checkout-sessions/:checkoutId/payments',
    validateRequest('params', checkoutSessionParamsSchema),
    validateRequest('body', createIntegratedPaymentSchema),
    createIntegratedPayment,
  );

  router.get(
    '/checkout-sessions/:checkoutId/payments/:paymentId',
    validateRequest('params', paymentStatusParamsSchema),
    getPaymentStatus,
  );

  return router;
}
