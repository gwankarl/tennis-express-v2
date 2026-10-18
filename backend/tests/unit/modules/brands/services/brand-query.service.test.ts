import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrandModel } from '../../../../../src/modules/brands/models/brand.model.js';
import { BrandQueryService } from '../../../../../src/modules/brands/services/brand-query.service.js';

vi.mock('../../../../../src/modules/brands/models/brand.model.js', () => ({
  BrandModel: {
    find: vi.fn(),
  },
}));

/* -------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* -------------------------------------------------------------------------- */

type MockBrand = {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
};

function createBrand(
  name: string,
  status: MockBrand['status'] = 'active',
): MockBrand {
  return {
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    status,
  };
}

function mockBrands(brands: MockBrand[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockResolvedValue(brands),
  };

  vi.mocked(BrandModel.find).mockReturnValue(query as never);

  return query;
}

/* -------------------------------------------------------------------------- */
/* Brand query service                                                        */
/* -------------------------------------------------------------------------- */

describe('BrandQueryService.getActiveBrands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves brands using an active status filter', async () => {
    mockBrands([]);

    await BrandQueryService.getActiveBrands();

    expect(BrandModel.find).toHaveBeenCalledWith({
      status: 'active',
    });
  });

  it('returns active brands', async () => {
    const brands = [createBrand('Wilson'), createBrand('Head')];

    mockBrands(brands);

    const result = await BrandQueryService.getActiveBrands();

    expect(result).toEqual(brands);
  });

  it('does not return inactive brands from the query result', async () => {
    const active = createBrand('Wilson');
    mockBrands([active]);

    const result = await BrandQueryService.getActiveBrands();

    expect(result).toEqual([active]);
    expect(result).not.toContainEqual(
      expect.objectContaining({ status: 'inactive' }),
    );
  });

  it('returns an empty array when no active brands exist', async () => {
    mockBrands([]);

    const result = await BrandQueryService.getActiveBrands();

    expect(result).toEqual([]);
  });

  it('excludes audit fields from the selected database projection', async () => {
    const query = mockBrands([]);

    await BrandQueryService.getActiveBrands();

    expect(query.select).toHaveBeenCalledWith('-createdBy -updatedBy');
  });

  it('sorts brands by name in ascending order', async () => {
    const query = mockBrands([]);

    await BrandQueryService.getActiveBrands();

    expect(query.sort).toHaveBeenCalledWith({ name: 1 });
  });

  it('propagates database errors', async () => {
    const error = new Error('Database unavailable');

    vi.mocked(BrandModel.find).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockRejectedValue(error),
    } as never);

    await expect(BrandQueryService.getActiveBrands()).rejects.toBe(error);
  });
});
