import { Types } from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';
import { ProductModel } from '../models/product.model.js';

/* -------------------------------------------------------------------------- */
/* Product retrieval service                                                  */
/* -------------------------------------------------------------------------- */

export interface SellerProductPaginationInput {
  page?: number;
  limit?: number;
}

/**
 * Retrieves and manages access to a seller's existing product listings.
 */
export class ProductRetrievalService {
  /**
   * Retrieves products belonging to the specified seller.
   *
   * All publication and moderation states are included so sellers can
   * manage drafts, pending listings, rejected listings, and archived items.
   */
  async getSellerProducts(
    sellerId: string,
    pagination: SellerProductPaginationInput = {},
  ) {
    this.validateSellerId(sellerId);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    if (!Number.isInteger(page) || page < 1) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PAGE',
        message: 'Page must be a positive integer.',
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PAGE_LIMIT',
        message: 'Page limit must be between 1 and 100.',
      });
    }

    const sellerObjectId = new Types.ObjectId(sellerId);
    const skip = (page - 1) * limit;

    const [products, totalItems] = await Promise.all([
      ProductModel.find({ sellerId: sellerObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),

      ProductModel.countDocuments({
        sellerId: sellerObjectId,
      }).exec(),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      products,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalItems > 0,
      },
    };
  }

  /**
   * Retrieves one product only if it belongs to the specified seller.
   *
   * Returning the same not-found response for nonexistent and
   * other-seller products avoids disclosing another seller's listings.
   */
  async getSellerProductById(sellerId: string, productId: string) {
    this.validateSellerId(sellerId);

    if (!Types.ObjectId.isValid(productId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRODUCT_ID',
        message: 'The product ID is invalid.',
      });
    }

    const product = await ProductModel.findOne({
      _id: new Types.ObjectId(productId),
      sellerId: new Types.ObjectId(sellerId),
    }).exec();

    if (!product) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'The requested product was not found.',
      });
    }

    return product;
  }

  /**
   * Validates the authenticated seller's identifier.
   */
  private validateSellerId(sellerId: string): void {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_SELLER_ID',
        message: 'The authenticated seller identity is invalid.',
      });
    }
  }
}

/** Default product retrieval service instance. */
export const productRetrievalService = new ProductRetrievalService();
