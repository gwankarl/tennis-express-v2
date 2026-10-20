import type { RequestHandler } from 'express';

import { StoreQueryService } from '../services/store-query.service.js';
import { storeDirectoryQuerySchema } from '../validations/store-directory.validation.js';

/** Dependencies used to construct the public store query controller. */
export interface StoreQueryControllerDependencies {
  storeQueryService?: StoreQueryService;
}

/** Creates controllers for publicly accessible store queries. */
export function createStoreQueryController(
  dependencies: StoreQueryControllerDependencies = {},
) {
  const storeQueryService =
    dependencies.storeQueryService ?? new StoreQueryService();

  const getPublicStores: RequestHandler = async (req, res, next) => {
    try {
      const query = storeDirectoryQuerySchema.parse(req.query);
      const result = await storeQueryService.getPublicStores(query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  const getPublicStoreBySlug: RequestHandler<{ slug: string }> = async (
    req,
    res,
    next,
  ) => {
    try {
      const store = await storeQueryService.getPublicStoreBySlug(
        req.params.slug,
      );

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  return { getPublicStores, getPublicStoreBySlug };
}

/** Default controller instance for public store queries. */
export const storeQueryController = createStoreQueryController();
