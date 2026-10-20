import type { Request, Response } from 'express';

import { adminProductDetailService } from '../services/admin-product-detail.service.js';

export async function getAdminProductDetails(
  req: Request,
  res: Response,
): Promise<Response> {
  const product = await adminProductDetailService.getProductDetails(
    req.params.productId as string,
  );

  return res.status(200).json({
    message: 'Product details retrieved successfully.',
    data: product,
  });
}
