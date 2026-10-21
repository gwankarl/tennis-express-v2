import type { Request, Response, NextFunction } from 'express';
import type { AddCartItemInput } from '../validations/cart.schemas.js';
import type { UpdateCartItemQuantityInput } from '../validations/cart-item-quantity.schema.js';

import { cartService } from '../services/cart.service.js';

export async function getCart(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cartService.getCart(req.auth!.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function addCartItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cartService.addItem(
      req.auth!.userId,
      req.body as AddCartItemInput,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCartItemQuantity(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cartService.updateItemQuantity(
      req.auth!.userId,
      req.params.variantId as string,
      req.body as UpdateCartItemQuantityInput,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeCartItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await cartService.removeItem(
      req.auth!.userId,
      req.params.variantId as string,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
