import type { NextFunction, Request, Response } from 'express';

import { sellerOrderPaymentService } from '../services/seller-order-payment.service.js';
import type { DirectPaymentDeclarationInput } from '../validations/direct-payment-declaration.schema.js';

/** Records the seller's declaration that a direct payment was received. */
export async function declareDirectPayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await sellerOrderPaymentService.declareDirectPayment(
      req.auth!.userId,
      req.params.orderId as string,
      req.get('Idempotency-Key') ?? '',
      req.body as DirectPaymentDeclarationInput,
    );

    res.status(result.reused ? 200 : 201).json({
      success: true,
      data: result.payment,
    });
  } catch (error) {
    next(error);
  }
}
