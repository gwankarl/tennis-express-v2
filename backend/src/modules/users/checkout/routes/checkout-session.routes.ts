import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import { createCheckoutSession } from '../controllers/checkout-session.controller.js';
import { createCheckoutSessionSchema } from '../validations/create-checkout-session.schema.js';

export const createCheckoutSessionRouter = (): Router => {
  const router = Router();

  router.use(createRequireAuthentication());

  router.post(
    '/',
    validateRequest('body', createCheckoutSessionSchema),
    createCheckoutSession,
  );

  return router;
};
