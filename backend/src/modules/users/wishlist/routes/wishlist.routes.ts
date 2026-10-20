import { Router } from 'express';

import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';
import {
  addWishlistProduct,
  getWishlist,
  removeWishlistProduct,
} from '../controllers/wishlist.controller.js';

export const createWishlistRouter = () => {
  const router = Router();

  router.use(createRequireAuthentication());

  router.get('/', getWishlist);
  router.post('/:productId', addWishlistProduct);
  router.delete('/:productId', removeWishlistProduct);

  return router;
};
