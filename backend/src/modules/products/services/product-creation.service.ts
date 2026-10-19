import { Types } from 'mongoose';

import { BrandModel } from '../../brands/models/brand.model.js';
import { CategoryModel } from '../../categories/models/category.model.js';
import { StoreModel } from '../../stores/models/store.model.js';
import { CloudinaryCleanupQueueService } from '../../users/services/cloudinary-cleanup-queue.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ProductModel } from '../models/product.model.js';
import {
  productImageUploadService,
  type ProductImageUploadInput,
} from './product-image-upload.service.js';

import type { ProductImage } from '../types/product.types.js';
import type { CreateProductInput } from '../validations/create-product.schema.js';

/** Product details accepted by the creation service, excluding image references. */
export type CreateProductServiceInput = Omit<CreateProductInput, 'images'>;

/** Handles the creation of seller product listings and their images. */
export class ProductCreationService {
  constructor(
    private readonly cleanupQueue = new CloudinaryCleanupQueueService(),
  ) {}

  /**
   * Creates a product listing and uploads its images in one operation.
   *
   * Seller identity, store ownership, image references, moderation status,
   * and publication status are controlled by the backend.
   */
  async createProduct(
    sellerId: string,
    input: CreateProductServiceInput,
    imageFiles: ProductImageUploadInput[],
    primaryImageIndex?: number,
  ) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_SELLER_ID',
        message: 'The authenticated seller identity is invalid.',
      });
    }

    if (imageFiles.length === 0) {
      throw new AppError({
        statusCode: 400,
        code: 'PRODUCT_IMAGES_REQUIRED',
        message: 'At least one product image is required.',
      });
    }

    const sellerObjectId = new Types.ObjectId(sellerId);

    /* Only sellers with an active store can create listings. */
    const store = await StoreModel.findOne({
      sellerId: sellerObjectId,
      status: 'active',
    })
      .select('_id sellerId')
      .lean()
      .exec();

    if (!store) {
      throw new AppError({
        statusCode: 403,
        code: 'ACTIVE_STORE_REQUIRED',
        message: 'An active store is required to create a product listing.',
      });
    }

    /* Products must belong to an active marketplace category. */
    const category = await CategoryModel.findOne({
      _id: input.categoryId,
      status: 'active',
    })
      .select('_id')
      .lean()
      .exec();

    if (!category) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRODUCT_CATEGORY',
        message: 'The selected product category is unavailable.',
      });
    }

    /* A supplied brand must exist and be active. */
    let brandId: Types.ObjectId | null = null;

    if (input.brandId) {
      const brand = await BrandModel.findOne({
        _id: input.brandId,
        status: 'active',
      })
        .select('_id')
        .lean()
        .exec();

      if (!brand) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_PRODUCT_BRAND',
          message: 'The selected product brand is unavailable.',
        });
      }

      brandId = brand._id;
    }

    const slug = await this.generateUniqueSlug(
      store._id,
      input.slug || input.name,
    );

    /* Upload images only after validating the product's related records. */
    const images: ProductImage[] =
      await productImageUploadService.uploadProductImages(
        sellerId,
        input.name,
        imageFiles,
        primaryImageIndex,
      );

    try {
      return await ProductModel.create({
        storeId: store._id,
        sellerId: sellerObjectId,
        name: input.name,
        slug,
        description: input.description,
        categoryId: category._id,
        brandId,
        condition: input.condition,
        attributes: input.attributes,
        images,
        moderationStatus: 'pending',
        publicationStatus: 'draft',
        publishedAt: null,
        submittedAt: null,
      });
    } catch (error) {
      /* Remove uploaded assets if the product could not be saved. */
      await this.queueImagesForCleanup(images);

      throw error;
    }
  }

  /**
   * Queues uploaded images for deletion when product creation fails.
   */
  private async queueImagesForCleanup(images: ProductImage[]): Promise<void> {
    for (const image of images) {
      try {
        await this.cleanupQueue.scheduleDeletion({
          publicId: image.publicId,
        });
      } catch (cleanupError) {
        console.error(
          'Failed to queue cleanup for an unassigned product image.',
          {
            publicId: image.publicId,
            cleanupError,
          },
        );
      }
    }
  }

  /**
   * Generates a URL-friendly slug that is unique within the seller's store.
   */
  private async generateUniqueSlug(
    storeId: Types.ObjectId,
    value: string,
  ): Promise<string> {
    const baseSlug = value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180)
      .replace(/-+$/g, '');

    if (!baseSlug) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRODUCT_SLUG',
        message: 'A valid product name or slug is required.',
      });
    }

    let slug = baseSlug;
    let suffix = 2;

    while (await ProductModel.exists({ storeId, slug })) {
      const suffixText = `-${suffix}`;

      slug = `${baseSlug
        .slice(0, 180 - suffixText.length)
        .replace(/-+$/g, '')}${suffixText}`;

      suffix += 1;
    }

    return slug;
  }
}

/** Default product creation service instance. */
export const productCreationService = new ProductCreationService();
