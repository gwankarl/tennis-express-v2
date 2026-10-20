import mongoose from 'mongoose';
import { ProductModel } from '../models/product.model.js';
import { ProductReviewModel } from '../models/product-review.model.js';

/**
 * Recalculates the rating summary using approved product reviews only.
 */
export class ProductRatingSummaryService {
  async refreshProductRatingSummary(productId: string) {
    const [summary] = await ProductReviewModel.aggregate<{
      averageRating: number;
      totalReviews: number;
    }>([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: '$productId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]).exec();

    const ratingSummary = {
      averageRating: summary
        ? Math.round(summary.averageRating * 100) / 100
        : 0,
      totalReviews: summary?.totalReviews ?? 0,
    };

    const product = await ProductModel.findByIdAndUpdate(
      productId,
      { $set: { ratingSummary } },
      { new: true, runValidators: true },
    )
      .select('_id ratingSummary')
      .lean()
      .exec();

    if (!product) {
      throw new Error('Cannot update the rating summary: product not found.');
    }

    return {
      productId: product._id,
      ...ratingSummary,
    };
  }
}

export const productRatingSummaryService = new ProductRatingSummaryService();
