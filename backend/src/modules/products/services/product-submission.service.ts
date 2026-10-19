import { Types } from 'mongoose';

import { StoreModel } from '../../stores/models/store.model.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ProductModel } from '../models/product.model.js';
import type { ProductImage } from '../types/product.types.js';

export class ProductSubmissionService {
  async submitProductForApproval(sellerId: string, productId: string) {
    if (
      !Types.ObjectId.isValid(sellerId) ||
      !Types.ObjectId.isValid(productId)
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_ID',
        message: 'Invalid seller or product ID.',
      });
    }

    const sellerObjectId = new Types.ObjectId(sellerId);
    const productObjectId = new Types.ObjectId(productId);

    const product = await ProductModel.findOne({
      _id: productObjectId,
      sellerId: sellerObjectId,
    });

    if (!product) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
      });
    }

    if (product.publicationStatus !== 'draft') {
      throw new AppError({
        statusCode: 409,
        code: 'PRODUCT_NOT_SUBMITTABLE',
        message: 'Only draft products can be submitted for approval.',
      });
    }

    const store = await StoreModel.findOne({
      _id: product.storeId,
      sellerId: sellerObjectId,
      status: 'active',
    });

    if (!store) {
      throw new AppError({
        statusCode: 409,
        code: 'ACTIVE_STORE_REQUIRED',
        message: 'An active store is required to submit a product.',
      });
    }

    if (!product.images || product.images.length === 0) {
      throw new AppError({
        statusCode: 400,
        code: 'PRODUCT_IMAGES_REQUIRED',
        message: 'Add at least one product image before submitting.',
      });
    }

    const primaryImages = product.images.filter(
      (image: ProductImage) => image.isPrimary,
    );

    if (primaryImages.length !== 1) {
      throw new AppError({
        statusCode: 400,
        code: 'PRIMARY_IMAGE_REQUIRED',
        message: 'A product must have exactly one primary image.',
      });
    }

    product.moderationStatus = 'pending';
    product.submittedAt = new Date();

    await product.save();

    return product;
  }
}

export const productSubmissionService = new ProductSubmissionService();
