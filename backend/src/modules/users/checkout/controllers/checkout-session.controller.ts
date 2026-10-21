import type { NextFunction, Request, Response } from 'express';

import { checkoutSessionService } from '../services/checkout-session.service.js';
import type { CreateCheckoutSessionInput } from '../validations/create-checkout-session.schema.js';

/** Creates a checkout session for the authenticated customer's cart. */
export async function createCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await checkoutSessionService.create(
      req.auth!.userId,
      req.get('Idempotency-Key') ?? '',
      req.body as CreateCheckoutSessionInput,
    );

    res.status(result.reused ? 200 : 201).json({
      success: true,
      data: result.session,
    });
  } catch (error) {
    next(error);
  }
}
