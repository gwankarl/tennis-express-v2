import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';

import { cloudinary } from '../../../../config/cloudinary.js';
import { AppError } from '../../../../shared/errors/app-error.js';
import { CloudinaryCleanupQueueService } from '../../../shared/users/services/cloudinary-cleanup-queue.service.js';

import type { ProductImage } from '../../../shared/products/types/product.types.js';

/** Input required to upload one product image. */
export interface ProductImageUploadInput {
  buffer: Buffer;
  mimetype: string;
}

/** Cloudinary response fields required by the product-image workflow. */
interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
}

/** Uploads product-gallery images and prepares their database references. */
export class ProductImageUploadService {
  constructor(
    private readonly cleanupQueue = new CloudinaryCleanupQueueService(),
  ) {}

  /**
   * Uploads product images and generates their database metadata.
   *
   * Images are uploaded sequentially to preserve their submitted order.
   * The first image becomes primary by default unless the seller selects
   * another image through primaryImageIndex.
   */
  async uploadProductImages(
    sellerId: string,
    productName: string,
    images: ProductImageUploadInput[],
    primaryImageIndex?: number,
  ): Promise<ProductImage[]> {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    if (!productName.trim()) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRODUCT_NAME',
        message: 'A product name is required to generate image alt text.',
      });
    }

    if (images.length === 0) {
      throw new AppError({
        statusCode: 400,
        code: 'PRODUCT_IMAGES_REQUIRED',
        message: 'At least one product image is required.',
      });
    }

    if (
      primaryImageIndex !== undefined &&
      (!Number.isInteger(primaryImageIndex) ||
        primaryImageIndex < 0 ||
        primaryImageIndex >= images.length)
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PRIMARY_IMAGE_INDEX',
        message: 'The selected primary image index is invalid.',
      });
    }

    const folder = `tennis-xpress/product-images/${sellerId}`;
    const uploadedImages: ProductImage[] = [];

    const selectedPrimaryIndex =
      images.length === 1 ? 0 : (primaryImageIndex ?? 0);

    try {
      for (const [index, image] of images.entries()) {
        const result = await this.uploadImage(folder, image);

        uploadedImages.push({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          altText: `${productName.trim()} - image ${index + 1}`,
          isPrimary: index === selectedPrimaryIndex,
          sortOrder: index,
        });
      }

      return uploadedImages;
    } catch {
      await this.queueUploadedImagesForCleanup(uploadedImages);

      throw new AppError({
        statusCode: 502,
        code: 'PRODUCT_IMAGE_UPLOAD_FAILED',
        message: 'One or more product images could not be uploaded.',
      });
    }
  }

  /**
   * Uploads one image buffer to Cloudinary.
   */
  private async uploadImage(
    folder: string,
    image: ProductImageUploadInput,
  ): Promise<CloudinaryUploadResult> {
    return new Promise<CloudinaryUploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: randomUUID(),
          resource_type: 'image',
          overwrite: false,
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(new Error('Cloudinary returned no upload result.'));
            return;
          }

          resolve(result);
        },
      );

      uploadStream.end(image.buffer);
    });
  }

  /**
   * Queues deletion of images uploaded before a batch failure.
   */
  private async queueUploadedImagesForCleanup(
    images: ProductImage[],
  ): Promise<void> {
    for (const image of images) {
      try {
        await this.cleanupQueue.scheduleDeletion({
          publicId: image.publicId,
        });
      } catch (error) {
        console.error(
          'Failed to queue cleanup for an unassigned product image.',
          {
            publicId: image.publicId,
            error,
          },
        );
      }
    }
  }
}

/** Default product-image upload service instance. */
export const productImageUploadService = new ProductImageUploadService();
