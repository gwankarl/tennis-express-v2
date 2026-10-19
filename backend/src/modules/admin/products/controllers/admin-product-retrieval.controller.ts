import type { Request, Response } from 'express';

import { AppError } from '../../../../shared/errors/app-error.js';
import { adminProductRetrievalService } from '../services/admin-product-retrieval.service.js';

export async function getPendingProducts(
  req: Request,
  res: Response,
): Promise<Response> {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_PAGINATION',
      message: 'Page must be positive and limit must be between 1 and 100.',
    });
  }

  const result = await adminProductRetrievalService.getPendingProducts(
    page,
    limit,
  );

  return res.status(200).json({
    message: 'Pending products retrieved successfully.',
    data: result.products,
    pagination: result.pagination,
  });
}
