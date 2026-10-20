import type { Request, Response } from 'express';

import { adminProductApprovalService } from '../services/admin-product-approval.service.js';

export async function approveAdminProduct(
  req: Request,
  res: Response,
): Promise<Response> {
  const product = await adminProductApprovalService.approveProduct(
    req.params.productId as string,
  );

  return res.status(200).json({
    message: 'Product approved and published successfully.',
    data: product,
  });
}
