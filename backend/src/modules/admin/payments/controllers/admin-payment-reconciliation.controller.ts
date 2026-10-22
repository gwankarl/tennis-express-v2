import type { NextFunction, Request, Response } from 'express';

import { adminPaymentReconciliationService } from '../services/admin-payment-reconciliation.service.js';
import type { PaymentReconciliationDecisionInput } from '../validations/payment-reconciliation.schema.js';

/** Returns payments that require administrative reconciliation. */
export async function getPaymentReconciliationQueue(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payments = await adminPaymentReconciliationService.getQueue();

    res.status(200).json({
      success: true,
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
}

/** Applies an administrator's decision to a payment. */
export async function reconcilePayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await adminPaymentReconciliationService.reconcile(
      req.auth!.userId,
      req.params.paymentId as string,
      req.body as PaymentReconciliationDecisionInput,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
