import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';

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
