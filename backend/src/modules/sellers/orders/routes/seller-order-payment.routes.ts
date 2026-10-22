import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createRequireRole } from '../../../shared/auth/middleware/require-role.js';
import { declareDirectPayment } from '../controllers/direct-payment-declaration.controller.js';
import {
  directPaymentDeclarationParamsSchema,
  directPaymentDeclarationSchema,
} from '../validations/direct-payment-declaration.schema.js';

/** Creates seller order payment-declaration endpoints. */
export function createSellerOrderPaymentRouter(): Router {
  const router = Router();

  router.post(
    '/:orderId/payment-declarations',
    createRequireAuthentication(),
    createRequireRole(['seller']),
    validateRequest('params', directPaymentDeclarationParamsSchema),
    validateRequest('body', directPaymentDeclarationSchema),
    declareDirectPayment,
  );

  return router;
}
