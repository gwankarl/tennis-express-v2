import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import {
  addCartItem,
  getCart,
  updateCartItemQuantity,
  removeCartItem,
} from '../controllers/cart.controller.js';
import { addCartItemSchema } from '../validations/cart.schemas.js';
import {
  cartItemParamsSchema,
  updateCartItemQuantitySchema,
} from '../validations/cart-item-quantity.schema.js';

export const createCartRouter = (): Router => {
  const router = Router();

  router.use(createRequireAuthentication());

  router.get('/', getCart);

  router.post(
    '/items',
    validateRequest('body', addCartItemSchema),
    addCartItem,
  );

  router.patch(
    '/items/:variantId',
    validateRequest('params', cartItemParamsSchema),
    validateRequest('body', updateCartItemQuantitySchema),
    updateCartItemQuantity,
  );

  router.delete(
    '/items/:variantId',
    validateRequest('params', cartItemParamsSchema),
    removeCartItem,
  );

  return router;
};
