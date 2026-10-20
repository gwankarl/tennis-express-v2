import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { ProductVariantModel } from '../../../shared/products/models/product-variant.model.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import { WishlistItemModel } from '../../../shared/wishlist/models/wishlist-item.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { UserModel } from '../../../shared/users/models/user.model.js';

export interface WishlistQuery {
  page: number;
  limit: number;
}

interface WishlistPageItem {
  productId: mongoose.Types.ObjectId;
  createdAt: Date;
}

/** Manages wishlist items for authenticated customers. */
export class WishlistService {
  /**
   * Saves a publicly visible product to the customer's wishlist.
   * Repeated requests do not create duplicate entries.
   */
  async addProduct(userId: string, productId: string) {
    this.validateIds(userId, productId);

    await this.ensurePublicProduct(productId);

    const item = await WishlistItemModel.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        productId: new mongoose.Types.ObjectId(productId),
      },
      {
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(userId),
          productId: new mongoose.Types.ObjectId(productId),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )
      .lean()
      .exec();

    return {
      productId: item!.productId.toString(),
      savedAt: item!.createdAt,
    };
  }

  /** Retrieves a paginated wishlist with currently public product details. */
  async getWishlist(userId: string, query: WishlistQuery) {
    if (!mongoose.isValidObjectId(userId)) {
      throw this.createUserNotFoundError();
    }

    const skip = (query.page - 1) * query.limit;

    if (!Number.isSafeInteger(skip)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PAGINATION',
        message: 'The requested page is too large.',
      });
    }

    const [wishlistResult] = await WishlistItemModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $sort: {
          createdAt: -1,
          _id: -1,
        },
      },
      {
        $lookup: {
          from: ProductModel.collection.name,
          let: { savedProductId: '$productId' },
          pipeline: [
            {
              $match: {
                moderationStatus: 'approved',
                publicationStatus: 'published',
                publishedAt: { $ne: null },
                $expr: { $eq: ['$_id', '$$savedProductId'] },
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
                  { $project: { _id: 1 } },
                ],
                as: 'eligibleStore',
              },
            },
            {
              $match: {
                'eligibleStore.0': { $exists: true },
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
            { $project: { _id: 1 } },
          ],
          as: 'publicProduct',
        },
      },
      {
        $match: {
          'publicProduct.0': { $exists: true },
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'totalItems' }],
          items: [
            { $skip: skip },
            { $limit: query.limit },
            {
              $project: {
                _id: 0,
                productId: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]).exec();

    const items: WishlistPageItem[] = wishlistResult?.items ?? [];
    const totalItems: number = wishlistResult?.metadata[0]?.totalItems ?? 0;

    const productIds = items.map((item) => item.productId);

    const products = productIds.length
      ? await ProductModel.aggregate([
          {
            $match: {
              _id: { $in: productIds },
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
                  },
                },
                {
                  $project: {
                    price: 1,
                    discount: 1,
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
            $addFields: {
              availablePrices: {
                $map: {
                  input: '$purchasableVariants',
                  as: 'variant',
                  in: {
                    $let: {
                      vars: {
                        discount: '$$variant.discount',
                      },
                      in: {
                        $cond: [
                          {
                            $and: [
                              { $ne: ['$$discount', null] },
                              {
                                $or: [
                                  {
                                    $eq: [
                                      {
                                        $ifNull: ['$$discount.startsAt', null],
                                      },
                                      null,
                                    ],
                                  },
                                  { $lte: ['$$discount.startsAt', new Date()] },
                                ],
                              },
                              {
                                $or: [
                                  {
                                    $eq: [
                                      {
                                        $ifNull: ['$$discount.endsAt', null],
                                      },
                                      null,
                                    ],
                                  },
                                  { $gt: ['$$discount.endsAt', new Date()] },
                                ],
                              },
                            ],
                          },
                          {
                            $cond: [
                              { $eq: ['$$discount.type', 'fixed_price'] },
                              '$$discount.value',
                              {
                                $round: [
                                  {
                                    $multiply: [
                                      '$$variant.price',
                                      {
                                        $subtract: [
                                          1,
                                          {
                                            $divide: ['$$discount.value', 100],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                  0,
                                ],
                              },
                            ],
                          },
                          '$$variant.price',
                        ],
                      },
                    },
                  },
                },
              },
              availableQuantity: {
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
            $project: {
              _id: 0,
              id: '$_id',
              name: 1,
              slug: 1,
              description: 1,
              images: 1,
              condition: 1,
              price: {
                $cond: [
                  { $gt: [{ $size: '$availablePrices' }, 0] },
                  { $min: '$availablePrices' },
                  null,
                ],
              },
              inStock: { $gt: ['$availableQuantity', 0] },
              availableQuantity: 1,
              rating: '$averageRating',
              totalReviews: 1,
              store: { $arrayElemAt: ['$store', 0] },
            },
          },
        ]).exec()
      : [];

    const productsById = new Map(
      products.map((product) => [product.id.toString(), product]),
    );

    const wishlistItems = items.flatMap((item) => {
      const product = productsById.get(item.productId.toString());

      return product
        ? [
            {
              product,
              savedAt: item.createdAt,
            },
          ]
        : [];
    });

    const totalPages = Math.ceil(totalItems / query.limit);

    return {
      items: wishlistItems,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1 && totalPages > 0,
      },
    };
  }

  /** Removes only the specified product from the authenticated user's wishlist. */
  async removeProduct(userId: string, productId: string) {
    this.validateIds(userId, productId);

    await WishlistItemModel.deleteOne({
      userId: new mongoose.Types.ObjectId(userId),
      productId: new mongoose.Types.ObjectId(productId),
    }).exec();

    return { productId, removed: true };
  }

  /** Ensures the requested product is currently publicly visible. */
  private async ensurePublicProduct(productId: string) {
    const product = await ProductModel.findOne({
      _id: productId,
      moderationStatus: 'approved',
      publicationStatus: 'published',
      publishedAt: { $ne: null },
    })
      .select('storeId sellerId')
      .lean()
      .exec();

    if (!product) {
      throw this.createProductNotFoundError();
    }

    const [store, seller] = await Promise.all([
      StoreModel.findOne({
        _id: product.storeId,
        sellerId: product.sellerId,
        status: 'active',
      })
        .select('_id')
        .lean()
        .exec(),
      UserModel.findOne({
        _id: product.sellerId,
        status: 'active',
        deletedAt: null,
        roles: { $in: ['seller', 'both'] },
      })
        .select('_id')
        .lean()
        .exec(),
    ]);

    if (!store || !seller) {
      throw this.createProductNotFoundError();
    }
  }

  private validateIds(userId: string, productId: string) {
    if (!mongoose.isValidObjectId(userId)) {
      throw this.createUserNotFoundError();
    }

    if (!mongoose.isValidObjectId(productId)) {
      throw this.createProductNotFoundError();
    }
  }

  private createProductNotFoundError() {
    return new AppError({
      statusCode: 404,
      code: 'PUBLIC_PRODUCT_NOT_FOUND',
      message: 'The requested product could not be found.',
    });
  }

  private createUserNotFoundError() {
    return new AppError({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'The user account could not be found.',
    });
  }
}

export const wishlistService = new WishlistService();
