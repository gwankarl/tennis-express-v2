import { Types } from 'mongoose';
import { AppError } from '../../../../shared/errors/app-error.js';

import { StoreModel } from '../../../shared/stores/models/store.model.js';

/**
 * Retrieves store profiles intended for public marketplace access.
 */
export class StoreQueryService {
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
}
