import type { Request, Response } from 'express';

import { AppError } from '../../../../shared/errors/app-error.js';
import { productSubmissionService } from '../services/product-submission.service.js';

export async function submitProductForApproval(
  req: Request,
  res: Response,
): Promise<Response> {
  const sellerId = req.auth?.userId;

  if (!sellerId) {
    throw new AppError({
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      message: 'Authentication is required.',
    });
  }

  const productId = String(req.params.productId);

  const product = await productSubmissionService.submitProductForApproval(
    sellerId,
    productId,
  );

  return res.status(200).json({
    message: 'Product submitted for administrative approval.',
    data: { product },
  });
}
