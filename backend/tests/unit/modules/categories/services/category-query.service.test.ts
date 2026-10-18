import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

import { CategoryModel } from '../../../../../src/modules/categories/models/category.model.js';
import { CategoryQueryService } from '../../../../../src/modules/categories/services/category-query.service.js';

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
  name: string;
  parentId: Types.ObjectId | null;
  status: 'active' | 'inactive';
};

function createCategory(
  name: string,
  status: MockCategory['status'] = 'active',
  parentId: Types.ObjectId | null = null,
): MockCategory {
  return {
    _id: new Types.ObjectId(),
    name,
    parentId,
    status,
  };
}

function mockCategories(categories: MockCategory[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockResolvedValue(categories),
  };

  vi.mocked(CategoryModel.find).mockReturnValue(query as never);

  return query;
}

describe('CategoryQueryService.getActiveCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active root categories', async () => {
    const category = createCategory('Tennis Rackets');
    mockCategories([category]);

    const result = await CategoryQueryService.getActiveCategories();

    expect(result).toEqual([category]);
    expect(CategoryModel.find).toHaveBeenCalledWith({});
  });

  it('excludes inactive categories', async () => {
    const active = createCategory('Tennis Rackets');
    const inactive = createCategory('Tennis Shoes', 'inactive');
    mockCategories([active, inactive]);

    const result = await CategoryQueryService.getActiveCategories();

    expect(result).toEqual([active]);
  });

  it('excludes active children of inactive parents', async () => {
    const parent = createCategory('Rackets', 'inactive');
    const child = createCategory('Junior Rackets', 'active', parent._id);
    mockCategories([parent, child]);

    const result = await CategoryQueryService.getActiveCategories();

    expect(result).toEqual([]);
  });

  it('excludes descendants of inactive ancestors at deeper levels', async () => {
    const root = createCategory('Equipment', 'inactive');
    const child = createCategory('Rackets', 'active', root._id);
    const grandchild = createCategory('Junior Rackets', 'active', child._id);
    mockCategories([root, child, grandchild]);

    const result = await CategoryQueryService.getActiveCategories();

    expect(result).toEqual([]);
  });

  it('excludes categories whose parent is missing', async () => {
    const missingParentId = new Types.ObjectId();
    const child = createCategory('Junior Rackets', 'active', missingParentId);
    mockCategories([child]);

    const result = await CategoryQueryService.getActiveCategories();

    expect(result).toEqual([]);
  });

  it('returns active categories in the database query order', async () => {
    const first = createCategory('Accessories');
    const second = createCategory('Rackets');
    const third = createCategory('Shoes');
    mockCategories([first, second, third]);

    const result = await CategoryQueryService.getActiveCategories();

    expect(result).toEqual([first, second, third]);
  });

  it('returns an empty array when no categories exist', async () => {
    mockCategories([]);

    const result = await CategoryQueryService.getActiveCategories();

    expect(result).toEqual([]);
  });

  it('excludes audit fields from the selected database projection', async () => {
    const query = mockCategories([]);

    await CategoryQueryService.getActiveCategories();

    expect(query.select).toHaveBeenCalledWith('-createdBy -updatedBy');
  });

  it('sorts by sort order and name in ascending order', async () => {
    const query = mockCategories([]);

    await CategoryQueryService.getActiveCategories();

    expect(query.sort).toHaveBeenCalledWith({
      sortOrder: 1,
      name: 1,
    });
  });
});
