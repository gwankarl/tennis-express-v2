import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginationQuerySchema,
} from '../../../../src/shared/validation/pagination-query.js';

describe('paginationQuerySchema', () => {
  it('uses defaults when pagination parameters are omitted', () => {
    expect(paginationQuerySchema.parse({})).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_SIZE,
    });
  });

  it('converts valid query strings to numbers', () => {
    expect(paginationQuerySchema.parse({ page: '2', limit: '10' })).toEqual({
      page: 2,
      limit: 10,
    });
  });

  it('rejects pages below one', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('rejects non-integer pagination values', () => {
    expect(paginationQuerySchema.safeParse({ page: '1.5' }).success).toBe(
      false,
    );
  });

  it('rejects limits above the maximum', () => {
    expect(
      paginationQuerySchema.safeParse({
        limit: String(MAX_PAGE_SIZE + 1),
      }).success,
    ).toBe(false);
  });

  it('rejects non-numeric values', () => {
    expect(paginationQuerySchema.safeParse({ page: 'invalid' }).success).toBe(
      false,
    );
  });
});
