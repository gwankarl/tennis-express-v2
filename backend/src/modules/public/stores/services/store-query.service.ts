import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import type { StoreDirectoryQuery } from '../validations/store-directory.validation.js';

/** Retrieves store profiles intended for public marketplace access. */
export class StoreQueryService {
  /**
   * Retrieves active stores belonging to active, eligible seller accounts.
   * Supports text search, location filters, and pagination.
   */
  async getPublicStores(query: StoreDirectoryQuery) {
    const { search, region, city, page, limit } = query;

    const eligibleSellers = await UserModel.find({
      status: 'active',
      deletedAt: null,
      roles: { $in: ['seller', 'both'] },
    })
      .select('_id')
      .lean()
      .exec();

    const filters: Record<string, unknown> = {
      status: 'active',
      sellerId: { $in: eligibleSellers.map((seller) => seller._id) },
    };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');

      filters.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    if (region) {
      const escapedRegion = region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters['location.region'] = new RegExp(`^${escapedRegion}$`, 'i');
    }

    if (city) {
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters['location.city'] = new RegExp(`^${escapedCity}$`, 'i');
    }

    const skip = (page - 1) * limit;

    const [stores, totalItems] = await Promise.all([
      StoreModel.find(filters)
        .select(
          'name slug description location logo deliveryOptions collectionOptions ratingSummary createdAt',
        )
        .sort({ createdAt: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      StoreModel.countDocuments(filters).exec(),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      stores: stores.map((store) => ({
        id: store._id.toString(),
        name: store.name,
        slug: store.slug,
        description: store.description,
        location: store.location,
        logo: store.logo,
        deliveryOptions: store.deliveryOptions,
        collectionOptions: store.collectionOptions,
        ratingSummary: store.ratingSummary,
        createdAt: store.createdAt,
      })),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retrieves a publicly visible store by its URL slug.
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
   * Uses the same response for missing and non-public stores.
   */
  private createPublicStoreNotFoundError() {
    return new AppError({
      statusCode: 404,
      code: 'PUBLIC_STORE_NOT_FOUND',
      message: 'The requested store could not be found.',
    });
  }
}
