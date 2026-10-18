import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createTestApp } from '../../../../helpers/test-app.js';
import { CategoryQueryService } from '../../../../../src/modules/categories/services/category-query.service.js';

vi.mock(
  '../../../../../src/modules/categories/services/category-query.service.js',
  () => ({
    CategoryQueryService: {
      getActiveCategories: vi.fn(),
    },
  }),
);

describe('GET /api/v1/categories', () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('allows public access without an authentication token', async () => {
    vi.mocked(CategoryQueryService.getActiveCategories).mockResolvedValue([]);

    const response = await request(app).get('/api/v1/categories');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        categories: [],
      },
    });
  });

  it('returns the categories provided by the query service', async () => {
    const categories = [
      {
        _id: '68f123456789012345678901',
        name: 'Tennis Rackets',
        slug: 'tennis-rackets',
        parentId: null,
        attributes: [],
        status: 'active',
        sortOrder: 1,
      },
      {
        _id: '68f123456789012345678902',
        name: 'Junior Rackets',
        slug: 'junior-rackets',
        parentId: '68f123456789012345678901',
        attributes: [],
        status: 'active',
        sortOrder: 2,
      },
    ];

    vi.mocked(CategoryQueryService.getActiveCategories).mockResolvedValue(
      categories as never,
    );

    const response = await request(app).get('/api/v1/categories');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        categories,
      },
    });
    expect(CategoryQueryService.getActiveCategories).toHaveBeenCalledOnce();
  });

  it('returns an empty array when no active categories exist', async () => {
    vi.mocked(CategoryQueryService.getActiveCategories).mockResolvedValue([]);

    const response = await request(app).get('/api/v1/categories');

    expect(response.status).toBe(200);
    expect(response.body.data.categories).toEqual([]);
  });

  it('forwards query service errors to the error handler', async () => {
    vi.mocked(CategoryQueryService.getActiveCategories).mockRejectedValue(
      new Error('Category retrieval failed'),
    );

    const response = await request(app).get('/api/v1/categories');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
});
