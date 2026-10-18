import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CategoryModel } from '../../../../../src/modules/categories/models/category.model.js';
import { CategoryCheckerService } from '../../../../../src/modules/categories/services/category-checker.service.js';

vi.mock(
  '../../../../../src/modules/categories/models/category.model.js',
  () => ({
    CategoryModel: {
      find: vi.fn(),
    },
  }),
);

type MockCategory = {
  _id: Types.ObjectId;
  parentId: Types.ObjectId | null;
  status: 'active' | 'inactive';
};

function createCategory(
  parentId: Types.ObjectId | null = null,
  status: MockCategory['status'] = 'active',
): MockCategory {
  return {
    _id: new Types.ObjectId(),
    parentId,
    status,
  };
}

function mockCategories(categories: MockCategory[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(categories),
  };

  vi.mocked(CategoryModel.find).mockReturnValue(query as never);

  return query;
}

describe('CategoryCheckerService', () => {
  let service: CategoryCheckerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CategoryCheckerService();
  });

  it('rejects an empty category selection', async () => {
    await expect(service.validateCategories([])).rejects.toMatchObject({
      statusCode: 400,
      code: 'SELLER_APPLICATION_CATEGORIES_REQUIRED',
    });

    expect(CategoryModel.find).not.toHaveBeenCalled();
  });

  it('rejects malformed category IDs', async () => {
    await expect(
      service.validateCategories(['not-an-object-id']),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_CATEGORY_ID',
    });

    expect(CategoryModel.find).not.toHaveBeenCalled();
  });

  it('rejects a category that does not exist', async () => {
    mockCategories([]);

    await expect(
      service.validateCategories([new Types.ObjectId().toString()]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_NOT_FOUND',
    });
  });

  it('rejects an inactive category', async () => {
    const category = createCategory(null, 'inactive');
    mockCategories([category]);

    await expect(
      service.validateCategories([category._id.toString()]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_NOT_ACTIVE',
    });
  });

  it('rejects a category with an inactive parent', async () => {
    const parent = createCategory(null, 'inactive');
    const child = createCategory(parent._id, 'active');
    mockCategories([parent, child]);

    await expect(
      service.validateCategories([child._id.toString()]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_ANCESTOR_NOT_ACTIVE',
    });
  });

  it('rejects a category with an inactive grandparent', async () => {
    const grandparent = createCategory(null, 'inactive');
    const parent = createCategory(grandparent._id, 'active');
    const child = createCategory(parent._id, 'active');
    mockCategories([grandparent, parent, child]);

    await expect(
      service.validateCategories([child._id.toString()]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_ANCESTOR_NOT_ACTIVE',
    });
  });

  it('accepts a category with an entirely active ancestor chain', async () => {
    const parent = createCategory();
    const child = createCategory(parent._id);
    mockCategories([parent, child]);

    await expect(
      service.validateCategories([child._id.toString()]),
    ).resolves.toBeUndefined();
  });

  it('rejects a category whose parent is missing', async () => {
    const child = createCategory(new Types.ObjectId());
    mockCategories([child]);

    await expect(
      service.validateCategories([child._id.toString()]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_INVALID_HIERARCHY',
    });
  });

  it('rejects selections containing a mix of valid and nonexistent categories', async () => {
    const category = createCategory();
    mockCategories([category]);

    await expect(
      service.validateCategories([
        category._id.toString(),
        new Types.ObjectId().toString(),
      ]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_NOT_FOUND',
    });
  });

  it('propagates database errors', async () => {
    const error = new Error('Database unavailable');

    vi.mocked(CategoryModel.find).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockRejectedValue(error),
    } as never);

    await expect(
      service.validateCategories([new Types.ObjectId().toString()]),
    ).rejects.toBe(error);
  });
});
