import { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';
import { StoreModel } from '../models/store.model.js';
import type {
  Store,
  StoreLocation,
  StoreStatus,
} from '../types/store.types.js';

export interface ProvisionStoreInput {
  sellerId: string;
  name: string;
  description: string;
  location: StoreLocation;
  session?: ClientSession;
}

/**
 * Creates the initial storefront for an approved seller.
 *
 * Provisioning is idempotent: an existing storefront for the seller
 * is returned instead of creating a second one.
 */
export class StoreProvisioningService {
  async provisionStore(input: ProvisionStoreInput): Promise<Store> {
    if (!Types.ObjectId.isValid(input.sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const name = input.name.trim();
    const description = input.description.trim();

    if (!name || !description) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_STORE_DETAILS',
        message: 'Store name and description are required.',
      });
    }

    const sellerId = new Types.ObjectId(input.sellerId);

    const existingStoreQuery = StoreModel.findOne({ sellerId });

    if (input.session) {
      existingStoreQuery.session(input.session);
    }

    const existingStore = await existingStoreQuery.exec();

    if (existingStore) {
      return existingStore.toObject() as Store;
    }

    const baseSlug = this.createSlug(name);

    if (!baseSlug) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_STORE_NAME',
        message: 'The store name cannot be converted into a valid URL slug.',
      });
    }

    /*
     * Check for slug collisions and append a numeric suffix when needed.
     * The unique database index remains the final concurrency safeguard.
     */
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
      const slugQuery = StoreModel.exists({ slug });

      if (input.session) {
        slugQuery.session(input.session);
      }

      if (!(await slugQuery)) {
        break;
      }

      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    try {
      const storeData = {
        sellerId,
        name,
        slug,
        description,
        location: input.location,
        logo: null,
        status: 'paused' as StoreStatus,
        deliveryOptions: [],
        collectionOptions: [],
        returnPolicy: null,
        ratingSummary: {
          averageRating: 0,
          totalReviews: 0,
        },
      };

      const store = input.session
        ? (
            await StoreModel.create([storeData], {
              session: input.session,
            })
          )[0]
        : await StoreModel.create(storeData);

      return store.toObject() as Store;
    } catch (error: unknown) {
      /*
       * Another request may have provisioned this seller concurrently.
       * Recover only when the duplicate-key error concerns the seller's
       * unique storefront constraint.
       */
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        const duplicateError = error as {
          keyPattern?: Record<string, number>;
          keyValue?: Record<string, unknown>;
        };

        const duplicateSellerId =
          duplicateError.keyPattern?.sellerId === 1 ||
          duplicateError.keyValue?.sellerId !== undefined;

        if (duplicateSellerId) {
          const existingStoreQuery = StoreModel.findOne({ sellerId });

          if (input.session) {
            existingStoreQuery.session(input.session);
          }

          const existingStore = await existingStoreQuery.exec();

          if (existingStore) {
            return existingStore.toObject() as Store;
          }
        }
      }

      throw error;
    }
  }

  private createSlug(name: string): string {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
      .replace(/-+$/g, '');
  }
}
