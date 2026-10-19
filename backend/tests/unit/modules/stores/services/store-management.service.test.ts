import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Types } from 'mongoose';

import { StoreModel } from '../../../../../src/modules/stores/models/store.model.js';
import { StoreManagementService } from '../../../../../src/modules/stores/services/store-management.service.js';

import { cloudinary } from '../../../../../src/config/cloudinary.js';
import { CloudinaryCleanupQueueService } from '../../../../../src/modules/users/services/cloudinary-cleanup-queue.service.js';

vi.mock('../../../../../src/modules/stores/models/store.model.js', () => ({
  StoreModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../../../../src/config/cloudinary.js', () => ({
  cloudinary: {
    uploader: {
      upload_stream: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

vi.mock(
  '../../../../../src/modules/users/services/cloudinary-cleanup-queue.service.js',
  () => ({
    CloudinaryCleanupQueueService: vi.fn().mockImplementation(function () {
      return {
        scheduleDeletion: vi.fn().mockResolvedValue(undefined),
      };
    }),
  }),
);

describe('StoreManagementService', () => {
  let service: StoreManagementService;

  const sellerId = new Types.ObjectId().toString();

  const existingStore = {
    _id: new Types.ObjectId(),
    sellerId: new Types.ObjectId(sellerId),
    name: 'Original Store',
    slug: 'original-store',
    description: 'Original description',
    location: {
      region: 'Centre',
      city: 'Yaounde',
      address: 'Original address',
    },
    logo: null,
    status: 'active',
    deliveryOptions: [],
    collectionOptions: [],
    returnPolicy: null,
    ratingSummary: {
      averageRating: 0,
      totalReviews: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFindOneAndUpdate = vi.mocked(StoreModel.findOneAndUpdate);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StoreManagementService();
  });

  describe('updateStoreIdentity', () => {
    it('updates the store name and description', async () => {
      const updatedStore = {
        ...existingStore,
        name: 'Updated Store',
        description: 'Updated description',
      };

      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(updatedStore),
      } as never);

      const result = await service.updateStoreIdentity(sellerId, {
        name: 'Updated Store',
        description: 'Updated description',
      });

      expect(result).toEqual(updatedStore);

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { sellerId: new Types.ObjectId(sellerId) },
        {
          $set: {
            name: 'Updated Store',
            description: 'Updated description',
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('trims surrounding whitespace from the name and description', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(existingStore),
      } as never);

      await service.updateStoreIdentity(sellerId, {
        name: '  Updated Store  ',
        description: '  Updated description  ',
      });

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { sellerId: new Types.ObjectId(sellerId) },
        {
          $set: {
            name: 'Updated Store',
            description: 'Updated description',
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('preserves the existing slug and unrelated store fields', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(existingStore),
      } as never);

      const result = await service.updateStoreIdentity(sellerId, {
        name: 'Updated Store',
        description: 'Updated description',
      });

      expect(result.slug).toBe('original-store');
      expect(result.location).toEqual(existingStore.location);
      expect(result.logo).toBeNull();
      expect(result.deliveryOptions).toEqual([]);
      expect(result.collectionOptions).toEqual([]);
      expect(result.returnPolicy).toBeNull();
    });

    it('rejects an invalid seller ID', async () => {
      await expect(
        service.updateStoreIdentity('invalid-id', {
          name: 'Updated Store',
          description: 'Updated description',
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
      });

      expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('throws STORE_NOT_FOUND when the seller has no store', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(
        service.updateStoreIdentity(sellerId, {
          name: 'Updated Store',
          description: 'Updated description',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
      });
    });
  });

  describe('updateStoreLocation', () => {
    const location = {
      region: 'Littoral',
      city: 'Douala',
      address: 'Bonanjo',
    };

    it('updates the store location', async () => {
      const updatedStore = {
        ...existingStore,
        location,
      };

      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(updatedStore),
      } as never);

      const result = await service.updateStoreLocation(sellerId, {
        location,
      });

      expect(result).toEqual(updatedStore);

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { sellerId: new Types.ObjectId(sellerId) },
        {
          $set: {
            location,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('trims whitespace from location fields', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(existingStore),
      } as never);

      await service.updateStoreLocation(sellerId, {
        location: {
          region: ' Littoral ',
          city: ' Douala ',
          address: ' Bonanjo ',
        },
      });

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { sellerId: new Types.ObjectId(sellerId) },
        {
          $set: {
            location: {
              region: 'Littoral',
              city: 'Douala',
              address: 'Bonanjo',
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('rejects an invalid seller ID', async () => {
      await expect(
        service.updateStoreLocation('invalid-id', { location }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
      });

      expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('throws STORE_NOT_FOUND when the seller has no store', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(
        service.updateStoreLocation(sellerId, { location }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
      });
    });

    it('does not modify unrelated store fields', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(existingStore),
      } as never);

      const result = await service.updateStoreLocation(sellerId, {
        location,
      });

      expect(result.name).toBe(existingStore.name);
      expect(result.description).toBe(existingStore.description);
      expect(result.slug).toBe(existingStore.slug);
    });
  });

  describe('updateStoreLogo', () => {
    const logo = {
      publicId: 'tennis-xpress/store-logos/test-logo',
      secureUrl:
        'https://res.cloudinary.com/example/image/upload/test-logo.webp',
    };

    const uploadInput = {
      buffer: Buffer.from('fake-image-content'),
      mimetype: 'image/webp',
    };

    const mockFindOne = vi.mocked(StoreModel.findOne);
    const mockUploadStream = vi.mocked(cloudinary.uploader.upload_stream);
    const mockDestroy = vi.mocked(cloudinary.uploader.destroy);
    const mockCleanupConstructor = vi.mocked(CloudinaryCleanupQueueService);

    function mockExistingStore(existingLogo: typeof logo | null = null) {
      mockFindOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue({
              logo: existingLogo,
            }),
          }),
        }),
      } as never);
    }

    function mockSuccessfulUpload() {
      mockUploadStream.mockImplementation(((...args: unknown[]) => {
        const callback = args[1] as (
          error: Error | null,
          result?: {
            public_id: string;
            secure_url: string;
          },
        ) => void;

        callback(null, {
          public_id: logo.publicId,
          secure_url: logo.secureUrl,
        });

        return {
          end: vi.fn(),
        };
      }) as never);
    }

    function mockUpdatedStore(updatedLogo = logo) {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...existingStore,
          logo: updatedLogo,
        }),
      } as never);
    }

    beforeEach(() => {
      mockExistingStore();
      mockSuccessfulUpload();
      mockUpdatedStore();
    });

    it('uploads and assigns the new logo to the seller store', async () => {
      const result = await service.updateStoreLogo(sellerId, uploadInput);

      expect(result.logo).toEqual(logo);

      expect(mockFindOne).toHaveBeenCalledWith({
        sellerId: new Types.ObjectId(sellerId),
      });

      expect(mockUploadStream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'tennis-xpress/store-logos',
          resource_type: 'image',
          overwrite: false,
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        }),
        expect.any(Function),
      );

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { sellerId: new Types.ObjectId(sellerId) },
        { $set: { logo } },
        { new: true, runValidators: true },
      );

      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it('rejects an invalid seller ID', async () => {
      await expect(
        service.updateStoreLogo('invalid-id', uploadInput),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_SELLER_ID',
      });

      expect(mockFindOne).not.toHaveBeenCalled();
      expect(mockUploadStream).not.toHaveBeenCalled();
    });

    it('throws STORE_NOT_FOUND when the seller has no store', async () => {
      mockFindOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(null),
          }),
        }),
      } as never);

      await expect(
        service.updateStoreLogo(sellerId, uploadInput),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'STORE_NOT_FOUND',
      });

      expect(mockUploadStream).not.toHaveBeenCalled();
    });

    it('throws STORE_LOGO_UPLOAD_FAILED when Cloudinary upload fails', async () => {
      mockUploadStream.mockImplementation(((...args: unknown[]) => {
        const callback = args[1] as (
          error: Error | null,
          result?: {
            public_id: string;
            secure_url: string;
          },
        ) => void;

        callback(new Error('Cloudinary upload failed'));

        return {
          end: vi.fn(),
        };
      }) as never);

      await expect(
        service.updateStoreLogo(sellerId, uploadInput),
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'STORE_LOGO_UPLOAD_FAILED',
      });

      expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('queues the new logo for cleanup if the database update fails', async () => {
      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockRejectedValue(new Error('Database update failed')),
      } as never);

      await expect(
        service.updateStoreLogo(sellerId, uploadInput),
      ).rejects.toThrow('Database update failed');

      const cleanupQueue = mockCleanupConstructor.mock.results.at(-1)?.value;

      expect(cleanupQueue.scheduleDeletion).toHaveBeenCalledWith({
        publicId: logo.publicId,
      });
    });

    it('deletes the previous logo after successfully assigning the new logo', async () => {
      const previousLogo = {
        publicId: 'tennis-xpress/store-logos/previous-logo',
        secureUrl: 'https://res.cloudinary.com/example/previous-logo.webp',
      };

      mockExistingStore(previousLogo);

      const callOrder: string[] = [];

      mockFindOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockImplementation(async () => {
          callOrder.push('database-update');

          return {
            ...existingStore,
            logo,
          };
        }),
      } as never);

      mockDestroy.mockImplementation(async () => {
        callOrder.push('delete-previous-logo');

        return { result: 'ok' } as never;
      });

      await service.updateStoreLogo(sellerId, uploadInput);

      expect(callOrder).toEqual(['database-update', 'delete-previous-logo']);

      expect(mockDestroy).toHaveBeenCalledWith(previousLogo.publicId, {
        resource_type: 'image',
        invalidate: true,
      });
    });

    it('queues the previous logo for cleanup if its deletion fails', async () => {
      const previousLogo = {
        publicId: 'tennis-xpress/store-logos/previous-logo',
        secureUrl: 'https://res.cloudinary.com/example/previous-logo.webp',
      };

      mockExistingStore(previousLogo);

      mockDestroy.mockRejectedValue(new Error('Cloudinary deletion failed'));

      const result = await service.updateStoreLogo(sellerId, uploadInput);

      expect(result.logo).toEqual(logo);

      const cleanupQueue = mockCleanupConstructor.mock.results.at(-1)?.value;

      expect(cleanupQueue.scheduleDeletion).toHaveBeenCalledWith({
        publicId: previousLogo.publicId,
      });
    });
  });
});
