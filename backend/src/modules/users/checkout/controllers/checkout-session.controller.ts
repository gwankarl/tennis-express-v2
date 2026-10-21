import type { NextFunction, Request, Response } from 'express';

import { checkoutSessionService } from '../services/checkout-session.service.js';
import type { CreateCheckoutSessionInput } from '../validations/create-checkout-session.schema.js';
import type { UpdateCheckoutFulfilmentInput } from '../validations/update-checkout-fulfilment.schema.js';
import type { RevalidateCheckoutSessionInput } from '../validations/revalidate-checkout-session.schema.js';
import type { ConfirmCheckoutSessionInput } from '../validations/confirm-checkout-session.schema.js';
import type { CancelCheckoutSessionInput } from '../validations/cancel-checkout-session.schema.js';

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

/** Retrieves one checkout session for the authenticated customer. */
export async function getCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await checkoutSessionService.getById(
      req.auth!.userId,
      req.params.checkoutId as string,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/** Updates fulfilment selections for the authenticated customer's checkout. */
export async function updateCheckoutFulfilment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await checkoutSessionService.updateFulfilment(
      req.auth!.userId,
      req.params.checkoutId as string,
      req.body as UpdateCheckoutFulfilmentInput,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/** Revalidates the authenticated customer's checkout snapshot and reservations. */
export async function revalidateCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await checkoutSessionService.revalidate(
      req.auth!.userId,
      req.params.checkoutId as string,
      req.body as RevalidateCheckoutSessionInput,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/** Confirms the customer's approved checkout revision. */
export async function confirmCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await checkoutSessionService.confirm(
      req.auth!.userId,
      req.params.checkoutId as string,
      req.body as ConfirmCheckoutSessionInput,
    );

    res.status(result.reused ? 200 : 201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/** Cancels the authenticated customer's active checkout. */
export async function cancelCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await checkoutSessionService.cancel(
      req.auth!.userId,
      req.params.checkoutId as string,
      req.body as CancelCheckoutSessionInput,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
