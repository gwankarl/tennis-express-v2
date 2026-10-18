import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBrandQueryController } from '../../../../../src/modules/brands/controllers/brand-query.controller.js';

import type { BrandQueryControllerService } from '../../../../../src/modules/brands/controllers/brand-query.controller.js';

/* -------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* -------------------------------------------------------------------------- */

function createResponse(): Response {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return response as unknown as Response;
}

function createNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

async function invokeGetBrands(brandQueryService: BrandQueryControllerService) {
  const controller = createBrandQueryController({ brandQueryService });
  const req = {} as Request;
  const res = createResponse();
  const next = createNext();

  await (
    controller.getBrands as unknown as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void>
  )(req, res, next);

  return { res, next };
}

/* -------------------------------------------------------------------------- */
/* Brand query controller                                                     */
/* -------------------------------------------------------------------------- */

describe('Brand query controller', () => {
  let brandQueryService: BrandQueryControllerService;

  beforeEach(() => {
    vi.clearAllMocks();

    brandQueryService = {
      getActiveBrands: vi.fn(),
    };
  });

  it('returns active brands with a successful response', async () => {
    const brands = [
      { _id: 'brand-1', name: 'Wilson', slug: 'wilson' },
      { _id: 'brand-2', name: 'Head', slug: 'head' },
    ];

    vi.mocked(brandQueryService.getActiveBrands).mockResolvedValue(brands);

    const { res, next } = await invokeGetBrands(brandQueryService);

    expect(brandQueryService.getActiveBrands).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { brands },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns an empty array when no active brands exist', async () => {
    vi.mocked(brandQueryService.getActiveBrands).mockResolvedValue([]);

    const { res, next } = await invokeGetBrands(brandQueryService);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { brands: [] },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards service errors to the error handler', async () => {
    const error = new Error('Database unavailable');

    vi.mocked(brandQueryService.getActiveBrands).mockRejectedValue(error);

    const { res, next } = await invokeGetBrands(brandQueryService);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
