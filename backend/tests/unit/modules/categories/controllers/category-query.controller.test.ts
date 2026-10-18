import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

import {
  createCategoryQueryController,
  type CategoryQueryControllerService,
} from '../../../../../src/modules/categories/controllers/category-query.controller.js';

describe('CategoryQueryController', () => {
  let service: CategoryQueryControllerService;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    service = {
      getActiveCategories: vi.fn(),
    };

    req = {};

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  it('returns active categories with HTTP 200', async () => {
    const categories = [
      { _id: 'category-1', name: 'Tennis Rackets', status: 'active' },
      { _id: 'category-2', name: 'Tennis Shoes', status: 'active' },
    ];

    vi.mocked(service.getActiveCategories).mockResolvedValue(categories);

    const controller = createCategoryQueryController({
      categoryQueryService: service,
    });

    await controller.getCategories(req as Request, res as Response, next);

    expect(service.getActiveCategories).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { categories },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns an empty array when no categories exist', async () => {
    vi.mocked(service.getActiveCategories).mockResolvedValue([]);

    const controller = createCategoryQueryController({
      categoryQueryService: service,
    });

    await controller.getCategories(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { categories: [] },
    });
  });

  it('forwards service errors to the error handler', async () => {
    const error = new Error('Category retrieval failed');

    vi.mocked(service.getActiveCategories).mockRejectedValue(error);

    const controller = createCategoryQueryController({
      categoryQueryService: service,
    });

    await controller.getCategories(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
