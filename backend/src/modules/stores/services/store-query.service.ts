import { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { UserModel } from '../../users/models/user.model.js';
import { StoreModel } from '../models/store.model.js';

/**
 * Retrieves store profiles intended for public marketplace access.
 */
export class StoreQueryService {
  /**
   * Retrieves a publicly visible store by its URL slug.
   *
   * A store is publicly visible only when the store is active and its
   * associated seller has an active, non-deleted account with a seller role.
   */
  async getPublicStoreBySlug(slug: string) {
    const normalizedSlug = slug.trim().toLowerCase();

    const store = await StoreModel.findOne({
      slug: normalizedSlug,
      status: 'active',
    })
      .select(
        'sellerId name slug description location logo deliveryOptions collectionOptions returnPolicy ratingSummary',
      )
      .lean()
      .exec();

    if (!store) {
      throw this.createPublicStoreNotFoundError();
    }

    const seller = await UserModel.findOne({
      _id: store.sellerId,
      status: 'active',
      deletedAt: null,
      roles: { $in: ['seller', 'both'] },
    })
      .select('_id')
      .lean()
      .exec();

    if (!seller) {
      throw this.createPublicStoreNotFoundError();
    }

    return {
      name: store.name,
      slug: store.slug,
      description: store.description,
      location: store.location,
      logo: store.logo,
      deliveryOptions: store.deliveryOptions,
      collectionOptions: store.collectionOptions,
      returnPolicy: store.returnPolicy,
      ratingSummary: store.ratingSummary,
    };
  }

  /**
   * Retrieves the authenticated seller's own store profile.
   *
   * Unlike public retrieval, this method includes the store status so the
   * owner can inspect their store even when it is paused.
   */
  async getMyStore(sellerId: string) {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
        message: 'The seller ID is invalid.',
      });
    }

    const store = await StoreModel.findOne({
      sellerId: new Types.ObjectId(sellerId),
    })
      .select(
        'name slug description location logo status deliveryOptions collectionOptions returnPolicy ratingSummary createdAt updatedAt',
      )
      .lean()
      .exec();

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
   * Uses the same response for missing and non-public stores so the endpoint
   * does not reveal whether an unavailable store exists.
   */
  private createPublicStoreNotFoundError() {
    return new AppError({
      statusCode: 404,
      code: 'PUBLIC_STORE_NOT_FOUND',
      message: 'The requested store could not be found.',
    });
  }
}
