import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import {
  createCheckoutSession,
  getCheckoutSession,
  updateCheckoutFulfilment,
  revalidateCheckoutSession,
  confirmCheckoutSession,
  cancelCheckoutSession,
} from '../controllers/checkout-session.controller.js';

import { createCheckoutSessionSchema } from '../validations/create-checkout-session.schema.js';
import { checkoutSessionParamsSchema } from '../validations/checkout-session-params.schema.js';
import { updateCheckoutFulfilmentSchema } from '../validations/update-checkout-fulfilment.schema.js';
import { revalidateCheckoutSessionSchema } from '../validations/revalidate-checkout-session.schema.js';
import { confirmCheckoutSessionSchema } from '../validations/confirm-checkout-session.schema.js';
import { cancelCheckoutSessionSchema } from '../validations/cancel-checkout-session.schema.js';

export const createCheckoutSessionRouter = (): Router => {
  const router = Router();

  router.use(createRequireAuthentication());

  router.post(
    '/',
    validateRequest('body', createCheckoutSessionSchema),
    createCheckoutSession,
  );

  router.get(
    '/:checkoutId',
    validateRequest('params', checkoutSessionParamsSchema),
    getCheckoutSession,
  );

  router.patch(
    '/:checkoutId/fulfilment',
    validateRequest('params', checkoutSessionParamsSchema),
    validateRequest('body', updateCheckoutFulfilmentSchema),
    updateCheckoutFulfilment,
  );

  router.post(
    '/:checkoutId/revalidate',
    validateRequest('params', checkoutSessionParamsSchema),
    validateRequest('body', revalidateCheckoutSessionSchema),
    revalidateCheckoutSession,
  );

  router.post(
    '/:checkoutId/confirm',
    validateRequest('params', checkoutSessionParamsSchema),
    validateRequest('body', confirmCheckoutSessionSchema),
    confirmCheckoutSession,
  );

  router.post(
    '/:checkoutId/cancel',
    validateRequest('params', checkoutSessionParamsSchema),
    validateRequest('body', cancelCheckoutSessionSchema),
    cancelCheckoutSession,
  );

  return router;
};
