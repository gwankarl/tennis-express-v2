import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import type { CurrentUserResponse } from '../../../shared/users/types/current-user.types.js';
import type { UserImageReference } from '../../../shared/users/types/user.types.js';
import { ProfileImageUploadService } from './profile-image-upload.service.js';
import { CloudinaryCleanupQueueService } from '../../../shared/users/services/cloudinary-cleanup-queue.service.js';

interface UpdateProfileImageInput {
  buffer: Buffer;
  mimetype: string;
}

/** Coordinates profile-image storage and user-profile updates. */
export class ProfileImageUpdateService {
  constructor(
    private readonly imageUploadService = new ProfileImageUploadService(),
    private readonly cleanupQueueService = new CloudinaryCleanupQueueService(),
  ) {}

  /**
   * Replaces the authenticated user's profile image.
   *
   * The new image is uploaded before the database is changed.
   * The previous image is deleted only after the database update succeeds.
   */
  async updateProfileImage(
    userId: string,
    input: UpdateProfileImageInput,
  ): Promise<CurrentUserResponse> {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    const existingUser = await UserModel.findOne({
      _id: userId,
      deletedAt: null,
    })
      .select('profile.image')
      .lean()
      .exec();

    if (!existingUser) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    const previousImage = existingUser.profile
      .image as UserImageReference | null;

    const newImage = await this.imageUploadService.uploadProfileImage(input);

    let updatedUser;

    try {
      updatedUser = await UserModel.findOneAndUpdate(
        {
          _id: userId,
          deletedAt: null,
        },
        {
          $set: {
            'profile.image': newImage,
          },
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

      if (!updatedUser) {
        throw new AppError({
          statusCode: 404,
          code: 'USER_NOT_FOUND',
          message: 'The user account could not be found.',
        });
      }
    } catch (error) {
      try {
        await this.imageUploadService.deleteProfileImage(newImage.publicId);
      } catch {
        /* Preserve the original database-update error. */
      }

      throw error;
    }

    if (previousImage?.publicId) {
      try {
        await this.imageUploadService.deleteProfileImage(
          previousImage.publicId,
        );
      } catch (deleteError) {
        try {
          await this.cleanupQueueService.scheduleDeletion({
            publicId: previousImage.publicId,
            resourceType: 'image',
          });
        } catch (queueError) {
          /*
           * The profile update has already succeeded, so do not report it as
           * rolled back. Log both failures because cleanup could not be persisted.
           */
          console.error('Failed to schedule Cloudinary image cleanup.', {
            publicId: previousImage.publicId,
            deleteError,
            queueError,
          });
        }
      }
    }

    return {
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      emailVerifiedAt: updatedUser.emailVerifiedAt,
      roles: updatedUser.roles,
      status: updatedUser.status,
      profile: updatedUser.profile,
      notificationPreferences: updatedUser.notificationPreferences,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }
}
