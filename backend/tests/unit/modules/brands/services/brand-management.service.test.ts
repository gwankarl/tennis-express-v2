import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrandModel } from '../../../../../src/modules/brands/models/brand.model.js';
import { BrandManagementService } from '../../../../../src/modules/brands/services/brand-management.service.js';

import type { Brand } from '../../../../../src/modules/brands/types/brand.types.js';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  exists: vi.fn(),
  findById: vi.fn(),
}));

vi.mock('../../../../../src/modules/brands/models/brand.model.js', () => ({
  BrandModel: {
    create: mocks.create,
    exists: mocks.exists,
    findById: mocks.findById,
  },
}));

/* -------------------------------------------------------------------------- */
/* Test data                                                                  */
/* -------------------------------------------------------------------------- */

const adminId = new Types.ObjectId();

function createBrand(overrides: Partial<Brand> = {}): Brand {
  const now = new Date();

  return {
    _id: new Types.ObjectId(),
    name: 'Wilson',
    slug: 'wilson',
    description: null,
    logo: null,
    status: 'active',
    createdBy: adminId,
    updatedBy: adminId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mockCreatedBrand(brand: Brand) {
  mocks.create.mockResolvedValue({
    toObject: () => brand,
  });
}

function mockExistingBrand(brand: Brand) {
  const document = {
    ...brand,
    set: vi.fn(function (this: Record<string, unknown>, updates) {
      Object.assign(this, updates);
    }),
    save: vi.fn().mockResolvedValue(undefined),
    toObject: vi.fn(function (this: Record<string, unknown>) {
      return { ...this };
    }),
  };

  mocks.findById.mockReturnValue({
    exec: vi.fn().mockResolvedValue(document),
  });

  return document;
}

/* -------------------------------------------------------------------------- */
/* Test setup                                                                 */
/* -------------------------------------------------------------------------- */

describe('BrandManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exists.mockResolvedValue(null);
  });

  /* ------------------------------------------------------------------------ */
  /* Brand creation                                                           */
  /* ------------------------------------------------------------------------ */

  describe('create', () => {
    it('creates a brand with a generated slug and default fields', async () => {
      const brand = createBrand();
      mockCreatedBrand(brand);

      const result = await BrandManagementService.create({
        name: 'Wilson',
        createdBy: adminId,
      });

      expect(mocks.exists).toHaveBeenCalledWith({ slug: 'wilson' });
      expect(BrandModel.create).toHaveBeenCalledWith({
        name: 'Wilson',
        slug: 'wilson',
        description: null,
        logo: null,
        status: 'active',
        createdBy: adminId,
        updatedBy: adminId,
      });

      expect(result).toEqual(brand);
    });

    it('normalizes the brand name when generating its slug', async () => {
      const brand = createBrand({
        name: 'Head Tennis',
        slug: 'head-tennis',
      });

      mockCreatedBrand(brand);

      await BrandManagementService.create({
        name: '  Head Tennis  ',
        createdBy: adminId,
      });

      expect(BrandModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '  Head Tennis  ',
          slug: 'head-tennis',
        }),
      );
    });

    it('generates a unique slug when the base slug already exists', async () => {
      mocks.exists
        .mockResolvedValueOnce({ _id: new Types.ObjectId() })
        .mockResolvedValueOnce(null);

      mockCreatedBrand(
        createBrand({
          name: 'Wilson',
          slug: 'wilson-2',
        }),
      );

      await BrandManagementService.create({
        name: 'Wilson',
        createdBy: adminId,
      });

      expect(mocks.exists).toHaveBeenNthCalledWith(1, {
        slug: 'wilson',
      });

      expect(mocks.exists).toHaveBeenNthCalledWith(2, {
        slug: 'wilson-2',
      });

      expect(BrandModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'wilson-2',
        }),
      );
    });

    it('rejects a name that cannot produce a valid slug', async () => {
      await expect(
        BrandManagementService.create({
          name: '!!!',
          createdBy: adminId,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'BRAND_INVALID_NAME',
      });

      expect(BrandModel.create).not.toHaveBeenCalled();
      expect(BrandModel.exists).not.toHaveBeenCalled();
    });

    it('propagates brand creation errors', async () => {
      const error = new Error('Database unavailable');

      mocks.create.mockRejectedValue(error);

      await expect(
        BrandManagementService.create({
          name: 'Wilson',
          createdBy: adminId,
        }),
      ).rejects.toBe(error);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Brand editing                                                            */
  /* ------------------------------------------------------------------------ */

  describe('update', () => {
    it('updates the brand name and generates a new slug', async () => {
      const existingBrand = createBrand();
      const document = mockExistingBrand(existingBrand);

      const updatedBrand = await BrandManagementService.update({
        brandId: existingBrand._id,
        updatedBy: adminId,
        changes: {
          name: 'Head Tennis',
        },
      });

      expect(BrandModel.findById).toHaveBeenCalledWith(existingBrand._id);

      expect(mocks.exists).toHaveBeenCalledWith({
        slug: 'head-tennis',
        _id: { $ne: existingBrand._id },
      });

      expect(document.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Head Tennis',
          slug: 'head-tennis',
          updatedBy: adminId,
        }),
      );

      expect(document.save).toHaveBeenCalledOnce();
      expect(updatedBrand).toBeDefined();
    });

    it('updates the description and logo without changing the slug', async () => {
      const existingBrand = createBrand();
      const document = mockExistingBrand(existingBrand);

      const changes = {
        description: 'Tennis equipment manufacturer',
        logo: {
          publicId: 'brands/wilson',
          secureUrl: 'https://example.com/wilson.png',
        },
      };

      await BrandManagementService.update({
        brandId: existingBrand._id,
        updatedBy: adminId,
        changes,
      });

      expect(document.set).toHaveBeenCalledWith({
        description: changes.description,
        logo: changes.logo,
        updatedBy: adminId,
      });

      expect(mocks.exists).not.toHaveBeenCalled();
      expect(document.save).toHaveBeenCalledOnce();
    });

    it('allows clearing the description and logo', async () => {
      const existingBrand = createBrand({
        description: 'Original description',
        logo: {
          publicId: 'brands/wilson',
          secureUrl: 'https://example.com/wilson.png',
        },
      });

      const document = mockExistingBrand(existingBrand);

      await BrandManagementService.update({
        brandId: existingBrand._id,
        updatedBy: adminId,
        changes: {
          description: null,
          logo: null,
        },
      });

      expect(document.set).toHaveBeenCalledWith({
        description: null,
        logo: null,
        updatedBy: adminId,
      });
    });

    it('generates a unique slug when renaming to an existing brand name', async () => {
      const existingBrand = createBrand();
      const document = mockExistingBrand(existingBrand);

      mocks.exists
        .mockResolvedValueOnce({ _id: new Types.ObjectId() })
        .mockResolvedValueOnce(null);

      await BrandManagementService.update({
        brandId: existingBrand._id,
        updatedBy: adminId,
        changes: {
          name: 'Head',
        },
      });

      expect(mocks.exists).toHaveBeenNthCalledWith(1, {
        slug: 'head',
        _id: { $ne: existingBrand._id },
      });

      expect(mocks.exists).toHaveBeenNthCalledWith(2, {
        slug: 'head-2',
        _id: { $ne: existingBrand._id },
      });

      expect(document.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Head',
          slug: 'head-2',
        }),
      );
    });

    it('rejects an invalid name without saving the brand', async () => {
      const existingBrand = createBrand();
      const document = mockExistingBrand(existingBrand);

      await expect(
        BrandManagementService.update({
          brandId: existingBrand._id,
          updatedBy: adminId,
          changes: {
            name: '!!!',
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'BRAND_INVALID_NAME',
      });

      expect(document.set).not.toHaveBeenCalled();
      expect(document.save).not.toHaveBeenCalled();
    });

    it('returns a not-found error when the brand does not exist', async () => {
      mocks.findById.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        BrandManagementService.update({
          brandId: new Types.ObjectId(),
          updatedBy: adminId,
          changes: {
            name: 'Head Tennis',
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'BRAND_NOT_FOUND',
      });
    });

    it('propagates database errors', async () => {
      const error = new Error('Database unavailable');

      mocks.findById.mockReturnValue({
        exec: vi.fn().mockRejectedValue(error),
      });

      await expect(
        BrandManagementService.update({
          brandId: new Types.ObjectId(),
          updatedBy: adminId,
          changes: {
            name: 'Head Tennis',
          },
        }),
      ).rejects.toBe(error);
    });
  });
});
