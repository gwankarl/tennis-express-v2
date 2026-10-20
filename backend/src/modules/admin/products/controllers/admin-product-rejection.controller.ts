import type { Request, Response } from 'express';

import { adminProductRejectionService } from '../services/admin-product-rejection.service.js';

export async function rejectAdminProduct(
  req: Request,
  res: Response,
): Promise<Response> {
  const product = await adminProductRejectionService.rejectProduct(
    req.params.productId as string,
  );

  return res.status(200).json({
    message: 'Product rejected successfully.',
    data: product,
  });
}
