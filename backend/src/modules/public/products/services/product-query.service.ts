import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { CategoryModel } from '../../../shared/categories/models/category.model.js';
import { ProductVariantModel } from '../../../shared/products/models/product-variant.model.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import type { ProductListingQuery } from '../validations/product-listing.validation.js';
import type { CategoryAttribute } from '../../../shared/categories/types/category.types.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { BrandModel } from '../../../shared/brands/models/brand.model.js';

import { variantPricingService } from '../../../shared/products/services/variant-pricing.service.js';
import type { RelatedProductsQuery } from '../validations/related-products.validation.js';

type AttributeFilter = Record<string, string>;

const createInvalidFilterError = (message: string) =>
  new AppError({
    statusCode: 400,
    code: 'INVALID_PRODUCT_FILTER',
    message,
  });

/**
 * Retrieves products intended for public marketplace access.
 */
export class ProductQueryService {
  /**
   * Retrieves a filtered and paginated list of publicly visible products.
   */
  async getPublicProducts(query: ProductListingQuery) {
    const skip = (query.page - 1) * query.limit;

    if (!Number.isSafeInteger(skip)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PAGINATION',
        message: 'The requested page is too large.',
      });
    }

    const productFilters: Record<string, unknown> = {};

    if (query.categoryId) {
      productFilters.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    }

    if (query.brandId) {
      productFilters.brandId = new mongoose.Types.ObjectId(query.brandId);
    }

    if (query.sellerId) {
      productFilters.sellerId = new mongoose.Types.ObjectId(query.sellerId);
    }

    if (query.storeId) {
      productFilters.storeId = new mongoose.Types.ObjectId(query.storeId);
    }

    if (query.condition) {
      productFilters.condition = query.condition;
    }

    const attributeFilters = query.attributes as AttributeFilter;

    if (Object.keys(attributeFilters).length > 0) {
      if (!query.categoryId) {
        throw createInvalidFilterError(
          'A category must be selected when filtering by category attributes.',
        );
      }

      const category = await CategoryModel.findOne({
        _id: query.categoryId,
        status: 'active',
      })
        .select('attributes')
        .lean()
        .exec();

      if (!category) {
        throw createInvalidFilterError('The selected category is unavailable.');
      }

      for (const [slug, value] of Object.entries(attributeFilters)) {
        const definition = category.attributes.find(
          (attribute: CategoryAttribute) =>
            attribute.slug === slug && attribute.filterable,
        );

        if (!definition) {
          throw createInvalidFilterError(
            `The attribute "${slug}" is not filterable for this category.`,
          );
        }

        let parsedValue: unknown = value;

        if (definition.type === 'number') {
          if (value.trim() === '' || !Number.isFinite(Number(value))) {
            throw createInvalidFilterError(
              `The "${slug}" attribute must be a valid number.`,
            );
          }

          parsedValue = Number(value);
        } else if (definition.type === 'boolean') {
          if (value !== 'true' && value !== 'false') {
            throw createInvalidFilterError(
              `The "${slug}" attribute must be true or false.`,
            );
          }

          parsedValue = value === 'true';
        } else if (
          definition.type === 'select' &&
          !definition.options.includes(value)
        ) {
          throw createInvalidFilterError(
            `The value for "${slug}" is not an allowed option.`,
          );
        }

        productFilters[`attributes.${slug}`] = parsedValue;
      }
    }

    const now = new Date();

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

    const searchRegex = query.search
      ? new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : null;

    const [result] = await ProductModel.aggregate([
      {
        $match: {
          moderationStatus: 'approved',
          publicationStatus: 'published',
          publishedAt: { $ne: null },
          ...productFilters,
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
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$productStoreId'] },
                    { $eq: ['$sellerId', '$$productSellerId'] },
                    { $eq: ['$status', 'active'] },
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
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$productSellerId'] },
                    { $eq: ['$status', 'active'] },
                    { $eq: ['$deletedAt', null] },
                    {
                      $gt: [
                        {
                          $size: {
                            $setIntersection: [
                              { $ifNull: ['$roles', []] },
                              ['seller', 'both'],
                            ],
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'seller',
        },
      },
      {
        $match: {
          'seller.0': { $exists: true },
        },
      },

      {
        $lookup: {
          from: BrandModel.collection.name,
          let: { productBrandId: '$brandId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$productBrandId'],
                },
              },
            },
            {
              $project: {
                _id: 0,
                name: 1,
              },
            },
          ],
          as: 'brand',
        },
      },
      {
        $match: searchRegex
          ? {
              $or: [
                { name: searchRegex },
                { description: searchRegex },
                { 'brand.name': searchRegex },
              ],
            }
          : {},
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
                $expr: {
                  $and: [
                    { $eq: ['$productId', '$$productId'] },
                    { $eq: ['$sellerId', '$$productSellerId'] },
                    { $eq: ['$status', 'active'] },
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
                _id: 1,
                attributes: 1,
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
        $addFields: {
          lowestActivePrice: {
            $min: '$variants.effectivePrice',
          },
          lowestPurchasablePrice: {
            $min: '$purchasableVariants.effectivePrice',
          },
          totalAvailableQuantity: {
            $sum: '$variants.availableQuantity',
          },
          inStock: {
            $gt: [{ $sum: '$variants.availableQuantity' }, 0],
          },
          averageRating: {
            $ifNull: ['$ratingSummary.averageRating', 0],
          },
          totalReviews: {
            $ifNull: ['$ratingSummary.totalReviews', 0],
          },
          matchesPriceRange: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$purchasableVariants',
                    as: 'variant',
                    cond: {
                      $and: [
                        ...(query.minPrice !== undefined
                          ? [
                              {
                                $gte: [
                                  '$$variant.effectivePrice',
                                  query.minPrice,
                                ],
                              },
                            ]
                          : []),
                        ...(query.maxPrice !== undefined
                          ? [
                              {
                                $lte: [
                                  '$$variant.effectivePrice',
                                  query.maxPrice,
                                ],
                              },
                            ]
                          : []),
                      ],
                    },
                  },
                },
              },
              0,
            ],
          },
        },
      },

      {
        $match: {
          ...(query.inStock ? { inStock: true } : {}),
          ...(query.minRating !== undefined
            ? { averageRating: { $gte: query.minRating } }
            : {}),
          ...(query.minPrice !== undefined || query.maxPrice !== undefined
            ? { matchesPriceRange: true }
            : {}),
        },
      },

      {
        $addFields: {
          priceSort: {
            $ifNull: ['$lowestPurchasablePrice', Number.MAX_SAFE_INTEGER],
          },
        },
      },
      {
        $sort:
          query.sort === 'priceAsc'
            ? { priceSort: 1, _id: 1 }
            : query.sort === 'priceDesc'
              ? { priceSort: -1, _id: 1 }
              : query.sort === 'rating'
                ? {
                    averageRating: -1,
                    totalReviews: -1,
                    createdAt: -1,
                    _id: -1,
                  }
                : { createdAt: -1, _id: -1 },
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
                inStock: 1,
                availableQuantity: '$totalAvailableQuantity',
                rating: '$averageRating',
                totalReviews: 1,
                store: { $arrayElemAt: ['$store', 0] },
              },
            },
          ],
        },
      },
    ]).exec();

    const totalItems: number = result?.metadata[0]?.totalItems ?? 0;
    const totalPages = Math.ceil(totalItems / query.limit);

    return {
      products: result?.items ?? [],
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

  /**
   * Retrieves complete customer-facing details for a publicly visible product.
   */
  async getPublicProductById(productId: string) {
    if (!mongoose.isValidObjectId(productId)) {
      throw this.createPublicProductNotFoundError();
    }

    const product = await ProductModel.findOne({
      _id: productId,
      moderationStatus: 'approved',
      publicationStatus: 'published',
      publishedAt: { $ne: null },
    })
      .select(
        'storeId sellerId name slug description categoryId brandId condition attributes images publishedAt ratingSummary createdAt updatedAt',
      )
      .lean()
      .exec();

    if (!product) {
      throw this.createPublicProductNotFoundError();
    }

    const store = await StoreModel.findOne({
      _id: product.storeId,
      sellerId: product.sellerId,
      status: 'active',
    })
      .select(
        'name slug description location logo deliveryOptions collectionOptions returnPolicy ratingSummary',
      )
      .lean()
      .exec();

    if (!store) {
      throw this.createPublicProductNotFoundError();
    }

    const seller = await UserModel.findOne({
      _id: product.sellerId,
      status: 'active',
      deletedAt: null,
      roles: { $in: ['seller', 'both'] },
    })
      .select('_id')
      .lean()
      .exec();

    if (!seller) {
      throw this.createPublicProductNotFoundError();
    }

    const variants = await ProductVariantModel.find({
      productId: product._id,
      sellerId: product.sellerId,
      status: 'active',
    })
      .select('name attributes price stockQuantity reservedQuantity discount')
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec();

    const now = new Date();

    const publicVariants = variants.map((variant) => {
      const availableQuantity = Math.max(
        0,
        variant.stockQuantity - variant.reservedQuantity,
      );

      const discountedPrice = variantPricingService.getDiscountedPrice(
        variant.price,
        variant.discount,
        now,
      );

      return {
        id: variant._id,
        name: variant.name,
        attributes: variant.attributes,
        price: variant.price,
        effectivePrice: discountedPrice ?? variant.price,
        discount:
          discountedPrice !== null
            ? {
                type: variant.discount!.type,
                value: variant.discount!.value,
                startsAt: variant.discount!.startsAt,
                endsAt: variant.discount!.endsAt,
              }
            : null,
        availableQuantity,
        inStock: availableQuantity > 0,
      };
    });

    const purchasableVariants = publicVariants.filter(
      (variant) => variant.availableQuantity > 0,
    );

    const effectivePrices = purchasableVariants.map(
      (variant) => variant.effectivePrice,
    );

    return {
      id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      categoryId: product.categoryId,
      brandId: product.brandId,
      condition: product.condition,
      attributes: product.attributes,
      images: product.images,
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      rating: product.ratingSummary?.averageRating ?? 0,
      totalReviews: product.ratingSummary?.totalReviews ?? 0,
      ratingSummary: {
        averageRating: product.ratingSummary?.averageRating ?? 0,
        totalReviews: product.ratingSummary?.totalReviews ?? 0,
      },
      price: effectivePrices.length > 0 ? Math.min(...effectivePrices) : null,
      inStock: purchasableVariants.length > 0,
      variants: publicVariants,
      store: {
        name: store.name,
        slug: store.slug,
        description: store.description,
        location: store.location,
        logo: store.logo,
        deliveryOptions: store.deliveryOptions,
        collectionOptions: store.collectionOptions,
        returnPolicy: store.returnPolicy,
        ratingSummary: store.ratingSummary,
      },
    };
  }

  /**
   * Retrieves publicly visible products related to a given product.
   */
  async getRelatedProducts(productId: string, query: RelatedProductsQuery) {
    if (!mongoose.isValidObjectId(productId)) {
      throw this.createPublicProductNotFoundError();
    }

    const currentProduct = await this.getPublicProductById(productId);

    const relevanceConditions: Record<string, unknown>[] = [
      { categoryId: currentProduct.categoryId },
    ];

    if (currentProduct.brandId) {
      relevanceConditions.push({ brandId: currentProduct.brandId });
    }

    const candidates = await ProductModel.aggregate([
      {
        $match: {
          _id: { $ne: new mongoose.Types.ObjectId(productId) },
          moderationStatus: 'approved',
          publicationStatus: 'published',
          publishedAt: { $ne: null },
          $or: relevanceConditions,
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
                name: 1,
                slug: 1,
              },
            },
          ],
          as: 'store',
        },
      },
      {
        $unwind: '$store',
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
            candidateProductId: '$_id',
            candidateSellerId: '$sellerId',
          },
          pipeline: [
            {
              $match: {
                status: 'active',
                $expr: {
                  $and: [
                    { $eq: ['$productId', '$$candidateProductId'] },
                    { $eq: ['$sellerId', '$$candidateSellerId'] },
                  ],
                },
              },
            },
            {
              $project: {
                price: 1,
                stockQuantity: 1,
                reservedQuantity: 1,
                discount: 1,
              },
            },
          ],
          as: 'variants',
        },
      },
      {
        $addFields: {
          relevanceScore: {
            $add: [
              {
                $cond: [
                  { $eq: ['$categoryId', currentProduct.categoryId] },
                  4,
                  0,
                ],
              },
              {
                $cond: [
                  {
                    $and: [
                      { $ne: [currentProduct.brandId, null] },
                      { $eq: ['$brandId', currentProduct.brandId] },
                    ],
                  },
                  2,
                  0,
                ],
              },
              {
                $cond: [
                  { $eq: ['$condition', currentProduct.condition] },
                  1,
                  0,
                ],
              },
            ],
          },
        },
      },
      {
        $sort: {
          relevanceScore: -1,
          createdAt: -1,
          _id: 1,
        },
      },
      {
        $limit: query.limit,
      },
      {
        $project: {
          name: 1,
          slug: 1,
          description: 1,
          categoryId: 1,
          brandId: 1,
          condition: 1,
          attributes: 1,
          images: 1,
          publishedAt: 1,
          ratingSummary: 1,
          store: 1,
          variants: 1,
        },
      },
    ]).exec();

    const now = new Date();

    const products = candidates.map((product) => {
      const variants = product.variants.map(
        (variant: {
          price: number;
          stockQuantity: number;
          reservedQuantity: number;
          discount:
            | import('../../../shared/products/types/product-variant.types.js').VariantDiscount
            | null;
        }) => {
          const availableQuantity = Math.max(
            0,
            variant.stockQuantity - variant.reservedQuantity,
          );

          return {
            effectivePrice: variantPricingService.getEffectivePrice(
              variant.price,
              variant.discount,
              now,
            ),
            availableQuantity,
          };
        },
      );

      const purchasableVariants = variants.filter(
        (variant: { availableQuantity: number }) =>
          variant.availableQuantity > 0,
      );

      const prices = purchasableVariants.map(
        (variant: { effectivePrice: number }) => variant.effectivePrice,
      );

      return {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId: product.categoryId,
        brandId: product.brandId,
        condition: product.condition,
        attributes: product.attributes,
        images: product.images,
        publishedAt: product.publishedAt,
        price: prices.length > 0 ? Math.min(...prices) : null,
        effectivePrice: prices.length > 0 ? Math.min(...prices) : null,
        inStock: purchasableVariants.length > 0,
        availableQuantity: purchasableVariants.reduce(
          (total: number, variant: { availableQuantity: number }) =>
            total + variant.availableQuantity,
          0,
        ),
        rating: product.ratingSummary?.averageRating ?? 0,
        totalReviews: product.ratingSummary?.totalReviews ?? 0,
        store: product.store,
      };
    });

    return { products };
  }

  /**
   * Retrieves the newest publicly visible products with optional filters.
   */
  async getNewListings(query: ProductListingQuery) {
    return this.getPublicProducts({
      ...query,
      sort: 'newest',
    });
  }

  /**
   * Uses the same response for missing and non-public products.
   */
  private createPublicProductNotFoundError() {
    return new AppError({
      statusCode: 404,
      code: 'PUBLIC_PRODUCT_NOT_FOUND',
      message: 'The requested product could not be found.',
    });
  }
}

export const productQueryService = new ProductQueryService();
