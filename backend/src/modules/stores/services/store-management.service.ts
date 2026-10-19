import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';

import { AppError } from '../../../shared/errors/app-error.js';
import { StoreModel } from '../models/store.model.js';
import type { StoreLocation, StoreLogo } from '../types/store.types.js';

import { cloudinary } from '../../../config/cloudinary.js';
import { CloudinaryCleanupQueueService } from '../../users/services/cloudinary-cleanup-queue.service.js';

export interface UpdateStoreIdentityInput {
  name: string;
  description: string;
}

export interface UpdateStoreLocationInput {
  location: StoreLocation;
}

export interface UpdateStoreLogoInput {
  buffer: Buffer;
  mimetype: string;
}

export interface UpdateStoreDeliveryOptionsInput {
  deliveryOptions: Array<{
    name: string;
    description: string;
    fee: number;
  }>;
}

export interface UpdateStoreCollectionOptionsInput {
  collectionOptions: Array<{
    name: string;
    description: string;
    fee: number;
  }>;
}

export interface UpdateStoreReturnPolicyInput {
  returnPolicy: {
    summary: string;
    returnWindowDays: number;
    conditions: string;
  } | null;
}

/**
 * Handles seller-owned store profile updates.
 */
export class StoreManagementService {
  constructor(
    private readonly cleanupQueue = new CloudinaryCleanupQueueService(),
  ) {}
  /**
   * Updates the name and description of the authenticated seller's store.
   *
   * The existing slug is preserved so the store's public URL remains stable.
   */
  async updateStoreIdentity(sellerId: string, input: UpdateStoreIdentityInput) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const store = await StoreModel.findOneAndUpdate(
      { sellerId: new Types.ObjectId(sellerId) },
      {
        $set: {
          name: input.name.trim(),
          description: input.description.trim(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!store) {
      throw new AppError({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
        message: 'The seller store could not be found.',
      });
    }

    return store;
  }

  /**
   * Updates the location of the authenticated seller's store.
   */
  async updateStoreLocation(sellerId: string, input: UpdateStoreLocationInput) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const store = await StoreModel.findOneAndUpdate(
      { sellerId: new Types.ObjectId(sellerId) },
      {
        $set: {
          location: {
            region: input.location.region.trim(),
            city: input.location.city.trim(),
            address: input.location.address.trim(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!store) {
      throw new AppError({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
        message: 'The seller store could not be found.',
      });
    }

    return store;
  }

  /**
   * Uploads and assigns a new logo to the authenticated seller's store.
   *
   * The previous logo is deleted only after the database update succeeds.
   * Failed cleanup is queued for a later retry.
   */
  async updateStoreLogo(sellerId: string, input: UpdateStoreLogoInput) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const existingStore = await StoreModel.findOne({
      sellerId: new Types.ObjectId(sellerId),
    })
      .select('logo')
      .lean()
      .exec();

    if (!existingStore) {
      throw new AppError({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
        message: 'The seller store could not be found.',
      });
    }

    let uploadedLogo: StoreLogo;

    try {
      const result = await new Promise<{
        public_id: string;
        secure_url: string;
      }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'tennis-xpress/store-logos',
            public_id: randomUUID(),
            resource_type: 'image',
            overwrite: false,
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          },
          (error, uploadResult) => {
            if (error) {
              reject(error);
              return;
            }

            if (!uploadResult) {
              reject(new Error('Cloudinary returned no upload result.'));
              return;
            }

            resolve(uploadResult);
          },
        );

        uploadStream.end(input.buffer);
      });

      uploadedLogo = {
        publicId: result.public_id,
        secureUrl: result.secure_url,
      };
    } catch {
      throw new AppError({
        statusCode: 502,
        code: 'STORE_LOGO_UPLOAD_FAILED',
        message: 'The store logo could not be uploaded.',
      });
    }

    let updatedStore;

    try {
      updatedStore = await StoreModel.findOneAndUpdate(
        { sellerId: new Types.ObjectId(sellerId) },
        { $set: { logo: uploadedLogo } },
        { new: true, runValidators: true },
      ).exec();
    } catch (error) {
      try {
        await this.cleanupQueue.scheduleDeletion({
          publicId: uploadedLogo.publicId,
        });
      } catch (cleanupError) {
        console.error('Failed to queue cleanup for an unassigned store logo.', {
          cleanupError,
        });
      }

      throw error;
    }

    if (!updatedStore) {
      try {
        await this.cleanupQueue.scheduleDeletion({
          publicId: uploadedLogo.publicId,
        });
      } catch (cleanupError) {
        console.error('Failed to queue cleanup for an unassigned store logo.', {
          cleanupError,
        });
      }

      throw new AppError({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
        message: 'The seller store could not be found.',
      });
    }

    const previousLogo = existingStore.logo;

    if (previousLogo?.publicId) {
      try {
        const deletionResult = await cloudinary.uploader.destroy(
          previousLogo.publicId,
          {
            resource_type: 'image',
            invalidate: true,
          },
        );

        if (
          deletionResult.result !== 'ok' &&
          deletionResult.result !== 'not found'
        ) {
          throw new Error('Cloudinary could not delete the previous logo.');
        }
      } catch {
        try {
          await this.cleanupQueue.scheduleDeletion({
            publicId: previousLogo.publicId,
          });
        } catch (cleanupError) {
          console.error(
            'Failed to queue cleanup for the previous store logo.',
            { cleanupError },
          );
        }
      }
    }

    return updatedStore;
  }

  /**
   * Updates the delivery options of the authenticated seller's store.
   */
  async updateStoreDeliveryOptions(
    sellerId: string,
    input: UpdateStoreDeliveryOptionsInput,
  ) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const deliveryOptions = input.deliveryOptions.map((option) => ({
      name: option.name.trim(),
      description: option.description.trim(),
      fee: option.fee,
    }));

    const store = await StoreModel.findOneAndUpdate(
      { sellerId: new Types.ObjectId(sellerId) },
      {
        $set: {
          deliveryOptions,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!store) {
      throw new AppError({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
        message: 'The seller store could not be found.',
      });
    }

    return store;
  }

  /**
   * Updates the collection options of the authenticated seller's store.
   */
  async updateStoreCollectionOptions(
    sellerId: string,
    input: UpdateStoreCollectionOptionsInput,
  ) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const collectionOptions = input.collectionOptions.map((option) => ({
      name: option.name.trim(),
      description: option.description.trim(),
      fee: option.fee,
    }));

    const store = await StoreModel.findOneAndUpdate(
      { sellerId: new Types.ObjectId(sellerId) },
      {
        $set: {
          collectionOptions,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!store) {
      throw new AppError({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
        message: 'The seller store could not be found.',
      });
    }

    return store;
  }

  /**
   * Updates the return policy of the authenticated seller's store.
   */
  async updateStoreReturnPolicy(
    sellerId: string,
    input: UpdateStoreReturnPolicyInput,
  ) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const returnPolicy = input.returnPolicy
      ? {
          summary: input.returnPolicy.summary.trim(),
          returnWindowDays: input.returnPolicy.returnWindowDays,
          conditions: input.returnPolicy.conditions.trim(),
        }
      : null;

    const store = await StoreModel.findOneAndUpdate(
      { sellerId: new Types.ObjectId(sellerId) },
      {
        $set: {
          returnPolicy,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!store) {
      throw new AppError({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
        message: 'The seller store could not be found.',
      });
    }

    return store;
  }
}
