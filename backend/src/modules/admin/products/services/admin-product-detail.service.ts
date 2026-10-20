import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { BrandModel } from '../../../shared/brands/models/brand.model.js';
import { CategoryModel } from '../../../shared/categories/models/category.model.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { UserModel } from '../../../shared/users/models/user.model.js';

export class AdminProductDetailService {
  async getProductDetails(productId: string) {
    if (!mongoose.isObjectIdOrHexString(productId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRODUCT_ID',
        message: 'The provided product ID is invalid.',
      });
    }

    const product = await ProductModel.findById(productId)
      .populate({
        path: 'sellerId',
        model: UserModel,
        select:
          'email profile roles status emailVerifiedAt createdAt updatedAt',
      })
      .populate({
        path: 'storeId',
        model: StoreModel,
        select:
          'name slug description location logo status deliveryOptions collectionOptions returnPolicy ratingSummary createdAt updatedAt',
      })
      .populate({
        path: 'categoryId',
        model: CategoryModel,
        select: 'name slug parentId description attributes status',
      })
      .populate({
        path: 'brandId',
        model: BrandModel,
        select: 'name slug description logo status',
      })
      .lean();

    if (!product) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'The requested product could not be found.',
      });
    }

    return product;
  }
}

export const adminProductDetailService = new AdminProductDetailService();
