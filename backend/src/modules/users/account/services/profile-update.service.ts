import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import type { CurrentUserResponse } from '../../../shared/users/types/current-user.types.js';
import type { ProfileUpdateRequest } from '../validations/profile-update.validation.js';

/** Updates editable profile information for an existing user. */
export class ProfileUpdateService {
  /**
   * Applies only the supplied profile fields.
   *
   * Nested contact details are updated individually to preserve any
   * contact fields that the request does not include.
   *
   * @param userId - ID established by authentication middleware.
   * @param updates - Validated profile fields to update.
   * @returns The updated user's safe account information.
   */
  async updateProfile(
    userId: string,
    updates: ProfileUpdateRequest,
  ): Promise<CurrentUserResponse> {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    const setUpdates: Record<string, string> = {};

    if (updates.firstName !== undefined) {
      setUpdates['profile.firstName'] = updates.firstName;
    }

    if (updates.lastName !== undefined) {
      setUpdates['profile.lastName'] = updates.lastName;
    }

    if (updates.contactDetails?.phoneNumber !== undefined) {
      setUpdates['profile.contactDetails.phoneNumber'] =
        updates.contactDetails.phoneNumber;
    }

    if (updates.contactDetails?.preferredContactMethod !== undefined) {
      setUpdates['profile.contactDetails.preferredContactMethod'] =
        updates.contactDetails.preferredContactMethod;
    }

    const user = await UserModel.findOneAndUpdate(
      {
        _id: userId,
        deletedAt: null,
      },
      {
        $set: setUpdates,
      },
      {
        new: true,
        runValidators: true,
      },
    )
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
