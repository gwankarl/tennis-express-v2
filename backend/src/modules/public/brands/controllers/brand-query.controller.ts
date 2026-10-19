import type { RequestHandler } from 'express';

import { BrandQueryService } from '../services/brand-query.service.js';

/* -------------------------------------------------------------------------- */
/* Controller service contract                                                */
/* -------------------------------------------------------------------------- */

export interface BrandQueryControllerService {
  getActiveBrands(): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Controller dependencies                                                    */
/* -------------------------------------------------------------------------- */

export interface BrandQueryControllerDependencies {
  brandQueryService?: BrandQueryControllerService;
}

/* -------------------------------------------------------------------------- */
/* Brand query controller                                                     */
/* -------------------------------------------------------------------------- */

export function createBrandQueryController(
  dependencies: BrandQueryControllerDependencies = {},
) {
  const brandQueryService = dependencies.brandQueryService ?? BrandQueryService;

  /* ------------------------------------------------------------------------ */
  /* Retrieve active brands                                                  */
  /* ------------------------------------------------------------------------ */

  const getBrands: RequestHandler = async (_req, res, next) => {
    try {
      const brands = await brandQueryService.getActiveBrands();

      res.status(200).json({
        success: true,
        data: { brands },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    getBrands,
  };
}
