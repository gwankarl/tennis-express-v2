import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';

export class AdminProductApprovalService {
  async approveProduct(productId: string) {
    /* ---------------------------------------------------------------------- */
    /* Validate the product ID                                                */
    /* ---------------------------------------------------------------------- */

    if (!mongoose.isObjectIdOrHexString(productId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRODUCT_ID',
        message: 'The provided product ID is invalid.',
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Confirm that the product exists                                        */
    /* ---------------------------------------------------------------------- */

    const existingProduct = await ProductModel.findById(productId)
      .select('_id moderationStatus publicationStatus submittedAt')
      .lean();

    if (!existingProduct) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'The requested product could not be found.',
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Check moderation eligibility                                           */
    /* ---------------------------------------------------------------------- */

    const isEligible =
      existingProduct.moderationStatus === 'pending' &&
      existingProduct.publicationStatus === 'draft' &&
      existingProduct.submittedAt !== null;

    if (!isEligible) {
      throw new AppError({
        statusCode: 409,
        code: 'PRODUCT_NOT_ELIGIBLE_FOR_APPROVAL',
        message: 'Only submitted products awaiting moderation can be approved.',
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Approve and publish atomically                                         */
    /* ---------------------------------------------------------------------- */

    const updatedProduct = await ProductModel.findOneAndUpdate(
      {
        _id: productId,
        moderationStatus: 'pending',
        publicationStatus: 'draft',
        submittedAt: { $ne: null },
      },
      {
        $set: {
          moderationStatus: 'approved',
          publicationStatus: 'published',
          publishedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    /* ---------------------------------------------------------------------- */
    /* Handle a concurrent moderation change                                 */
    /* ---------------------------------------------------------------------- */

    if (!updatedProduct) {
      throw new AppError({
        statusCode: 409,
        code: 'PRODUCT_NOT_ELIGIBLE_FOR_APPROVAL',
        message:
          'The product is no longer eligible for approval. Refresh and review its current status.',
      });
    }

    return updatedProduct;
  }
}

export const adminProductApprovalService = new AdminProductApprovalService();
