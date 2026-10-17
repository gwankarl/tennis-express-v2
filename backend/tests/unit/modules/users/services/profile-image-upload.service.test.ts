import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloudinaryMocks = vi.hoisted(() => ({
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('../../../../../src/config/cloudinary.js', () => ({
  cloudinary: {
    uploader: {
      upload_stream: cloudinaryMocks.uploadStream,
      destroy: cloudinaryMocks.destroy,
    },
  },
}));

import { ProfileImageUploadService } from '../../../../../src/modules/users/services/profile-image-upload.service.js';

describe('ProfileImageUploadService', () => {
  let service: ProfileImageUploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProfileImageUploadService();
  });

  describe('uploadProfileImage', () => {
    it('uploads an image and returns its Cloudinary reference', async () => {
      cloudinaryMocks.uploadStream.mockImplementation(
        (
          _options: unknown,
          callback: (
            error: Error | null,
            result?: {
              public_id: string;
              secure_url: string;
            },
          ) => void,
        ) => ({
          end: () => {
            callback(null, {
              public_id: 'tennis-xpress/profile-images/image-123',
              secure_url:
                'https://res.cloudinary.com/demo/image/upload/image-123.jpg',
            });
          },
        }),
      );

      await expect(
        service.uploadProfileImage({
          buffer: Buffer.from('image-content'),
          mimetype: 'image/jpeg',
        }),
      ).resolves.toEqual({
        publicId: 'tennis-xpress/profile-images/image-123',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/image-123.jpg',
      });

      expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'tennis-xpress/profile-images',
          resource_type: 'image',
          overwrite: false,
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        }),
        expect.any(Function),
      );
    });

    it('throws an application error when Cloudinary upload fails', async () => {
      cloudinaryMocks.uploadStream.mockImplementation(
        (
          _options: unknown,
          callback: (error: Error | null, result?: never) => void,
        ) => ({
          end: () => callback(new Error('Cloudinary unavailable')),
        }),
      );

      await expect(
        service.uploadProfileImage({
          buffer: Buffer.from('image-content'),
          mimetype: 'image/jpeg',
        }),
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'PROFILE_IMAGE_UPLOAD_FAILED',
      });
    });

    it('throws an application error when Cloudinary returns no result', async () => {
      cloudinaryMocks.uploadStream.mockImplementation(
        (
          _options: unknown,
          callback: (
            error: Error | null,
            result?: {
              public_id: string;
              secure_url: string;
            },
          ) => void,
        ) => ({
          end: () => callback(null, undefined),
        }),
      );

      await expect(
        service.uploadProfileImage({
          buffer: Buffer.from('image-content'),
          mimetype: 'image/jpeg',
        }),
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'PROFILE_IMAGE_UPLOAD_FAILED',
      });
    });
  });

  describe('deleteProfileImage', () => {
    it('deletes an existing image successfully', async () => {
      cloudinaryMocks.destroy.mockResolvedValue({ result: 'ok' });

      await expect(
        service.deleteProfileImage('tennis-xpress/profile-images/image-123'),
      ).resolves.toBeUndefined();

      expect(cloudinaryMocks.destroy).toHaveBeenCalledWith(
        'tennis-xpress/profile-images/image-123',
        {
          resource_type: 'image',
          invalidate: true,
        },
      );
    });

    it('treats an image that is already missing as deleted', async () => {
      cloudinaryMocks.destroy.mockResolvedValue({ result: 'not found' });

      await expect(
        service.deleteProfileImage(
          'tennis-xpress/profile-images/missing-image',
        ),
      ).resolves.toBeUndefined();
    });

    it('throws an application error for an unexpected deletion result', async () => {
      cloudinaryMocks.destroy.mockResolvedValue({ result: 'error' });

      await expect(
        service.deleteProfileImage('tennis-xpress/profile-images/image-123'),
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'PROFILE_IMAGE_DELETE_FAILED',
      });
    });

    it('throws an application error when Cloudinary deletion fails', async () => {
      cloudinaryMocks.destroy.mockRejectedValue(
        new Error('Cloudinary unavailable'),
      );

      await expect(
        service.deleteProfileImage('tennis-xpress/profile-images/image-123'),
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'PROFILE_IMAGE_DELETE_FAILED',
      });
    });
  });
});
