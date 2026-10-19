import { Types } from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { BrandModel } from '../../../shared/brands/models/brand.model.js';
import { CategoryModel } from '../../../shared/categories/models/category.model.js';
import { CloudinaryCleanupQueueService } from '../../../shared/users/services/cloudinary-cleanup-queue.service.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import {
  productImageUploadService,
  type ProductImageUploadInput,
} from './product-image-upload.service.js';

import type { ProductImage } from '../../../shared/products/types/product.types.js';
import type { UpdateProductInput } from '../validations/update-product.schema.js';

/* -------------------------------------------------------------------------- */
/* Product update service                                                     */
/* -------------------------------------------------------------------------- */

/** Product fields accepted by the update service, excluding image controls. */
type ProductUpdateFields = Omit<
  UpdateProductInput,
  'removeImagePublicIds' | 'primaryImageIndex'
>;

/** Input for updating a seller-owned product and its image gallery. */
export interface UpdateProductServiceInput {
  fields: ProductUpdateFields;
  imageFiles: ProductImageUploadInput[];
  removeImagePublicIds?: string[];
  primaryImageIndex?: number;
}

/** Applies seller-authorized product changes and manages Cloudinary images. */
export class ProductUpdateService {
  constructor(
    private readonly cleanupQueue = new CloudinaryCleanupQueueService(),
  ) {}

  /**
   * Updates a seller-owned product and optionally modifies its image gallery.
   */
  async updateSellerProduct(
    sellerId: string,
    productId: string,
    input: UpdateProductServiceInput,
  ) {
    this.validateObjectId(sellerId, 'INVALID_SELLER_ID', 'seller');

    this.validateObjectId(productId, 'INVALID_PRODUCT_ID', 'product');

    const sellerObjectId = new Types.ObjectId(sellerId);
    const productObjectId = new Types.ObjectId(productId);

    const product = await ProductModel.findOne({
      _id: productObjectId,
      sellerId: sellerObjectId,
    }).exec();

    if (!product) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'The requested product was not found.',
      });
    }

    const {
      fields,
      imageFiles,
      removeImagePublicIds = [],
      primaryImageIndex,
    } = input;

    /* Validate related records before uploading any new images. */
    if (fields.categoryId) {
      const category = await CategoryModel.exists({
        _id: fields.categoryId,
        status: 'active',
      });

      if (!category) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_PRODUCT_CATEGORY',
          message: 'The selected product category is unavailable.',
        });
      }
    }

    if (fields.brandId) {
      const brand = await BrandModel.exists({
        _id: fields.brandId,
        status: 'active',
      });

      if (!brand) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_PRODUCT_BRAND',
          message: 'The selected product brand is unavailable.',
        });
      }
    }

    const existingImages: ProductImage[] = product.images.map(
      (image: ProductImage) => ({
        publicId: image.publicId,
        secureUrl: image.secureUrl,
        altText: image.altText,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
      }),
    );

    const removalIds = new Set(removeImagePublicIds);

    if (removalIds.size !== removeImagePublicIds.length) {
      throw new AppError({
        statusCode: 400,
        code: 'DUPLICATE_IMAGE_REMOVAL',
        message: 'An image cannot be selected for removal more than once.',
      });
    }

    const existingPublicIds = new Set(
      existingImages.map((image) => image.publicId),
    );

    for (const publicId of removalIds) {
      if (!existingPublicIds.has(publicId)) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_PRODUCT_IMAGE',
          message: 'One or more selected images do not belong to this product.',
        });
      }
    }

    const retainedImages = existingImages.filter(
      (image) => !removalIds.has(image.publicId),
    );

    if (retainedImages.length + imageFiles.length > 10) {
      throw new AppError({
        statusCode: 400,
        code: 'TOO_MANY_PRODUCT_IMAGES',
        message: 'A product can have at most 10 images.',
      });
    }

    if (retainedImages.length + imageFiles.length === 0) {
      throw new AppError({
        statusCode: 400,
        code: 'PRODUCT_IMAGES_REQUIRED',
        message: 'A product must have at least one image.',
      });
    }

    /* Upload new images before changing the database record. */
    const uploadedImages: ProductImage[] =
      imageFiles.length > 0
        ? await productImageUploadService.uploadProductImages(
            sellerId,
            fields.name ?? product.name,
            imageFiles,
          )
        : [];

    const newImages = uploadedImages.map((image) => ({
      ...image,
      isPrimary: false,
    }));

    const finalImages = [...retainedImages, ...newImages].map(
      (image, index) => ({
        ...image,
        sortOrder: index,
      }),
    );

    if (
      primaryImageIndex !== undefined &&
      primaryImageIndex >= finalImages.length
    ) {
      await this.queueImagesForCleanup(uploadedImages);

      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRIMARY_IMAGE_INDEX',
        message: 'The selected primary image index is invalid.',
      });
    }

    const currentPrimaryIndex = finalImages.findIndex(
      (image) => image.isPrimary,
    );

    const selectedPrimaryIndex =
      primaryImageIndex ?? (currentPrimaryIndex >= 0 ? currentPrimaryIndex : 0);

    finalImages.forEach((image, index) => {
      image.isPrimary = index === selectedPrimaryIndex;
    });

    /* Identity, category, brand, and condition changes require re-review. */
    const requiresModeration =
      (fields.name !== undefined && fields.name !== product.name) ||
      (fields.slug !== undefined && fields.slug !== product.slug) ||
      (fields.categoryId !== undefined &&
        fields.categoryId !== product.categoryId.toString()) ||
      (fields.brandId !== undefined &&
        (fields.brandId?.toString() ?? null) !==
          (product.brandId?.toString() ?? null)) ||
      (fields.condition !== undefined &&
        fields.condition !== product.condition);

    const previousImages = existingImages.filter((image) =>
      removalIds.has(image.publicId),
    );

    try {
      Object.assign(product, fields);
      product.images = finalImages;

      if (requiresModeration) {
        product.moderationStatus = 'pending';
      }

      await product.save();
    } catch (error) {
      await this.queueImagesForCleanup(uploadedImages);
      throw error;
    }

    /* Queue deletion only after the database no longer references the images. */
    await this.queueImagesForCleanup(previousImages);

    return product;
  }

  /**
   * Validates a MongoDB ObjectId string.
   */
  private validateObjectId(value: string, code: string, label: string): void {
    if (!Types.ObjectId.isValid(value)) {
      throw new AppError({
        statusCode: 400,
        code,
        message: `The ${label} ID is invalid.`,
      });
    }
  }

  /**
   * Queues Cloudinary assets for deletion without failing the saved update.
   */
  private async queueImagesForCleanup(images: ProductImage[]): Promise<void> {
    for (const image of images) {
      try {
        await this.cleanupQueue.scheduleDeletion({
          publicId: image.publicId,
        });
      } catch (error) {
        console.error('Failed to queue product image cleanup.', {
          publicId: image.publicId,
          error,
        });
      }
    }
  }
}

/** Default product update service instance. */
export const productUpdateService = new ProductUpdateService();
