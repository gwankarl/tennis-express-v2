import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import type { CurrentUserResponse } from '../../../shared/users/types/current-user.types.js';

/** Retrieves safe account information for the authenticated user. */
export class CurrentUserService {
  /**
   * Finds an account by ID and maps it to the public response shape.
   *
   * Deleted or nonexistent accounts are treated identically.
   *
   * @param userId - ID established by authentication middleware.
   * @returns The authenticated user's safe account information.
   */
  async getCurrentUser(userId: string): Promise<CurrentUserResponse> {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    const user = await UserModel.findOne({
      _id: userId,
      deletedAt: null,
    })
      .select(
        '_id email emailVerifiedAt roles status profile notificationPreferences lastLoginAt createdAt updatedAt',
      )
      .lean()
      .exec();

    if (!user) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    return {
      id: user._id.toString(),
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      roles: user.roles,
      status: user.status,
      profile: user.profile,
      notificationPreferences: user.notificationPreferences,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
