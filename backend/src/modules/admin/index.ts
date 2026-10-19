import { Router } from 'express';

import { createAdminSellerApplicationReviewRouter } from './sellers/routes/seller-application-review.routes.js';

import { createCategoryManagementRouter } from './categories/routes/category-management.routes.js';

import { createBrandManagementRouter } from './brands/routes/brand-management.routes.js';

import { createAdminProductRouter } from './products/routes/admin-product.routes.js';

/**
 * Creates the version 1 API router and registers its endpoints.
 *
 * @returns The configured router for API version 1.
 */
export function createV1AdminRouter(): Router {
  const v1AdminRouter = Router();

  /* Mount administrator-only seller application review endpoints. */
  v1AdminRouter.use(
    '/seller-applications',
    createAdminSellerApplicationReviewRouter(),
  );

  /* Mount administrator-only category management endpoints. */
  v1AdminRouter.use('/categories', createCategoryManagementRouter());

  v1AdminRouter.use('/brands', createBrandManagementRouter());

  /* Mount administrator-only product moderation endpoints. */
  v1AdminRouter.use('/products', createAdminProductRouter());

  return v1AdminRouter;
}
