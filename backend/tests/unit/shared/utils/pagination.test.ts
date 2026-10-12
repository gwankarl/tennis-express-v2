import { describe, expect, it } from 'vitest';

import {
  buildPaginationMeta,
  getPaginationOptions,
} from '../../../../src/shared/utils/pagination.js';

describe('getPaginationOptions', () => {
  it('calculates the database offset', () => {
    expect(getPaginationOptions({ page: 3, limit: 20 })).toEqual({
      page: 3,
      limit: 20,
      skip: 40,
    });
  });

  it('returns zero offset for the first page', () => {
    expect(getPaginationOptions({ page: 1, limit: 20 }).skip).toBe(0);
  });
});

describe('buildPaginationMeta', () => {
  it('builds metadata when multiple pages exist', () => {
    expect(buildPaginationMeta(2, 10, 25)).toEqual({
      page: 2,
      limit: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('handles an empty result set', () => {
    expect(buildPaginationMeta(1, 20, 0)).toEqual({
      page: 1,
      limit: 20,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('handles the last page', () => {
    expect(buildPaginationMeta(3, 10, 25).hasNextPage).toBe(false);
  });

  it('handles a single page', () => {
    expect(buildPaginationMeta(1, 10, 5)).toMatchObject({
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
