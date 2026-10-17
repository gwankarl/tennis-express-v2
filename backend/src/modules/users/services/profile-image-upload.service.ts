import { randomUUID } from 'node:crypto';

import { cloudinary } from '../../../config/cloudinary.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { UserImageReference } from '../types/user.types.js';

interface UploadProfileImageInput {
  buffer: Buffer;
  mimetype: string;
}

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
}

/** Uploads profile images to Cloudinary. */
export class ProfileImageUploadService {
  /**
   * Uploads an image buffer and returns its Cloudinary reference.
   */
  async uploadProfileImage(
    input: UploadProfileImageInput,
  ): Promise<UserImageReference> {
    try {
      const result = await new Promise<CloudinaryUploadResult>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'tennis-xpress/profile-images',
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
        },
      );

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
      };
    } catch {
      throw new AppError({
        statusCode: 502,
        code: 'PROFILE_IMAGE_UPLOAD_FAILED',
        message: 'The profile image could not be uploaded.',
      });
    }
  }

  /**
   * Deletes a previously uploaded profile image from Cloudinary.
   *
   * Treats an already-missing image as successfully deleted.
   *
   * @param publicId - The Cloudinary public ID of the image.
   */
  async deleteProfileImage(publicId: string): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });

      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error('Cloudinary could not delete the profile image.');
      }
    } catch {
      throw new AppError({
        statusCode: 502,
        code: 'PROFILE_IMAGE_DELETE_FAILED',
        message: 'The profile image could not be deleted from storage.',
      });
    }
  }
}
