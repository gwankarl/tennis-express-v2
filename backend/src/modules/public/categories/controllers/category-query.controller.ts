import type { RequestHandler } from 'express';

import { CategoryQueryService } from '../services/category-query.service.js';

/** Defines the category retrieval operation required by this controller. */
export interface CategoryQueryControllerService {
  getActiveCategories(): Promise<unknown[]>;
}

/** Dependencies required by the category query controller. */
export interface CategoryQueryControllerDependencies {
  categoryQueryService?: CategoryQueryControllerService;
}

/** Creates handlers for public category retrieval. */
export function createCategoryQueryController(
  dependencies: CategoryQueryControllerDependencies = {},
) {
  const categoryQueryService =
    dependencies.categoryQueryService ?? CategoryQueryService;

  const getCategories: RequestHandler = async (_req, res, next) => {
    try {
      const categories = await categoryQueryService.getActiveCategories();

      res.status(200).json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    getCategories,
  };
}
