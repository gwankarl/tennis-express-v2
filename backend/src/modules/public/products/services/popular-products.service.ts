import { ProductVariantModel } from '../../../shared/products/models/product-variant.model.js';
import { ProductViewActivityModel } from '../../../shared/products/models/product-view-activity.model.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { UserModel } from '../../../shared/users/models/user.model.js';

import type { PopularProductsQuery } from '../validations/popular-products.validation.js';

/** Retrieves publicly purchasable products ranked by recent genuine views. */
export class PopularProductsService {
  async getPopularProducts(query: PopularProductsQuery) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeDiscountExpression = {
      $and: [
        { $ne: ['$discount', null] },
        {
          $or: [
            { $eq: [{ $ifNull: ['$discount.startsAt', null] }, null] },
            { $lte: ['$discount.startsAt', now] },
          ],
        },
        {
          $or: [
            { $eq: [{ $ifNull: ['$discount.endsAt', null] }, null] },
            { $gt: ['$discount.endsAt', now] },
          ],
        },
      ],
    };

    const products = await ProductModel.aggregate([
      {
        $match: {
          moderationStatus: 'approved',
          publicationStatus: 'published',
          publishedAt: { $ne: null },
        },
      },
      {
        $lookup: {
          from: StoreModel.collection.name,
          let: {
            productStoreId: '$storeId',
            productSellerId: '$sellerId',
          },
          pipeline: [
            {
              $match: {
                status: 'active',
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$productStoreId'] },
                    { $eq: ['$sellerId', '$$productSellerId'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                name: 1,
                slug: 1,
              },
            },
          ],
          as: 'store',
        },
      },
      {
        $match: {
          'store.0': { $exists: true },
        },
      },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { productSellerId: '$sellerId' },
          pipeline: [
            {
              $match: {
                status: 'active',
                deletedAt: null,
                roles: { $in: ['seller', 'both'] },
                $expr: { $eq: ['$_id', '$$productSellerId'] },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'eligibleSeller',
        },
      },
      {
        $match: {
          'eligibleSeller.0': { $exists: true },
        },
      },
      {
        $lookup: {
          from: ProductVariantModel.collection.name,
          let: {
            productId: '$_id',
            productSellerId: '$sellerId',
          },
          pipeline: [
            {
              $match: {
                status: 'active',
                $expr: {
                  $and: [
                    { $eq: ['$productId', '$$productId'] },
                    { $eq: ['$sellerId', '$$productSellerId'] },
                  ],
                },
              },
            },
            {
              $addFields: {
                availableQuantity: {
                  $max: [
                    0,
                    {
                      $subtract: [
                        '$stockQuantity',
                        { $ifNull: ['$reservedQuantity', 0] },
                      ],
                    },
                  ],
                },
                discountIsActive: activeDiscountExpression,
              },
            },
            {
              $addFields: {
                effectivePrice: {
                  $cond: [
                    '$discountIsActive',
                    {
                      $cond: [
                        { $eq: ['$discount.type', 'fixed_price'] },
                        '$discount.value',
                        {
                          $round: [
                            {
                              $multiply: [
                                '$price',
                                {
                                  $subtract: [
                                    1,
                                    { $divide: ['$discount.value', 100] },
                                  ],
                                },
                              ],
                            },
                            0,
                          ],
                        },
                      ],
                    },
                    '$price',
                  ],
                },
              },
            },
            {
              $project: {
                effectivePrice: 1,
                availableQuantity: 1,
              },
            },
          ],
          as: 'variants',
        },
      },
      {
        $addFields: {
          purchasableVariants: {
            $filter: {
              input: '$variants',
              as: 'variant',
              cond: { $gt: ['$$variant.availableQuantity', 0] },
            },
          },
        },
      },
      {
        $match: {
          'purchasableVariants.0': { $exists: true },
        },
      },
      {
        $lookup: {
          from: ProductViewActivityModel.collection.name,
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                viewedAt: { $gte: windowStart },
                $expr: { $eq: ['$productId', '$$productId'] },
              },
            },
            {
              $count: 'viewCount',
            },
          ],
          as: 'viewActivity',
        },
      },
      {
        $addFields: {
          viewCount: {
            $ifNull: [{ $arrayElemAt: ['$viewActivity.viewCount', 0] }, 0],
          },
          lowestPurchasablePrice: {
            $min: '$purchasableVariants.effectivePrice',
          },
          totalAvailableQuantity: {
            $sum: '$purchasableVariants.availableQuantity',
          },
          averageRating: {
            $ifNull: ['$ratingSummary.averageRating', 0],
          },
          totalReviews: {
            $ifNull: ['$ratingSummary.totalReviews', 0],
          },
        },
      },
      {
        $match: {
          viewCount: { $gt: 0 },
        },
      },
      {
        $sort: {
          viewCount: -1,
          publishedAt: -1,
          _id: 1,
        },
      },
      {
        $limit: query.limit,
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          slug: 1,
          description: 1,
          categoryId: 1,
          brandId: 1,
          condition: 1,
          attributes: 1,
          images: 1,
          publishedAt: 1,
          price: '$lowestPurchasablePrice',
          effectivePrice: '$lowestPurchasablePrice',
          inStock: { $literal: true },
          availableQuantity: '$totalAvailableQuantity',
          rating: '$averageRating',
          totalReviews: 1,
          popularityScore: '$viewCount',
          store: { $arrayElemAt: ['$store', 0] },
        },
      },
    ]).exec();

    return { products };
  }
}

export const popularProductsService = new PopularProductsService();
