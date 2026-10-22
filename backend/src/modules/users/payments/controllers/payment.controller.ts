import type { NextFunction, Request, Response } from 'express';

import { paymentService } from '../services/payment.service.js';
import type { CreateIntegratedPaymentInput } from '../validations/create-integrated-payment.schema.js';

/** Starts an integrated payment for the authenticated customer's checkout. */
export async function createIntegratedPayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await paymentService.createIntegratedPayment(
      req.auth!.userId,
      req.params.checkoutId as string,
      req.get('Idempotency-Key') ?? '',
      req.body as CreateIntegratedPaymentInput,
    );

    res.status(result.reused ? 200 : 201).json({
      success: true,
      data: result.payment,
    });
  } catch (error) {
    next(error);
  }
}

/** Retrieves the authenticated customer's payment status. */
export async function getPaymentStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await paymentService.getPaymentStatus(
      req.auth!.userId,
      req.params.checkoutId as string,
      req.params.paymentId as string,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
