import { describe, expect, it } from 'vitest';

import {
  createCategorySchema,
  updateCategoryParamsSchema,
  updateCategorySchema,
} from '../../../../../src/modules/categories/validations/category.validation.js';

/* -------------------------------------------------------------------------- */
/* Create category validation                                                 */
/* -------------------------------------------------------------------------- */

describe('createCategorySchema', () => {
  it('accepts a category with only the required name', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
    });

    expect(result.success).toBe(true);
  });

  it('trims the category name', () => {
    const result = createCategorySchema.safeParse({
      name: '  Tennis Rackets  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.name).toBe('Tennis Rackets');
    }
  });

  it('rejects a missing category name', () => {
    const result = createCategorySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects an empty category name', () => {
    const result = createCategorySchema.safeParse({
      name: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a category name longer than 120 characters', () => {
    const result = createCategorySchema.safeParse({
      name: 'a'.repeat(121),
    });

    expect(result.success).toBe(false);
  });

  it('accepts a valid parent category ID', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      parentId: '507f1f77bcf86cd799439011',
    });

    expect(result.success).toBe(true);
  });

  it('accepts null as the parent ID for a root category', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Equipment',
      parentId: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid parent category ID', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      parentId: 'not-an-object-id',
    });

    expect(result.success).toBe(false);
  });

  it('accepts valid select attributes with options', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      attributes: [
        {
          name: 'Racket Material',
          slug: 'racket-material',
          type: 'select',
          required: true,
          options: ['Graphite', 'Aluminium'],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects select attributes without options', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      attributes: [
        {
          name: 'Racket Material',
          slug: 'racket-material',
          type: 'select',
          required: true,
          options: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects options on a non-select attribute', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      attributes: [
        {
          name: 'Weight',
          slug: 'weight',
          type: 'number',
          required: false,
          options: ['Light', 'Heavy'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported attribute types', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      attributes: [
        {
          name: 'Weight',
          slug: 'weight',
          type: 'date',
          required: false,
          options: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid attribute slug', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      attributes: [
        {
          name: 'Weight',
          slug: 'Racket Weight',
          type: 'number',
          required: false,
          options: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported category statuses', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      status: 'deleted',
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative sort orders', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      sortOrder: -1,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected request fields', () => {
    const result = createCategorySchema.safeParse({
      name: 'Tennis Rackets',
      createdBy: '507f1f77bcf86cd799439011',
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Update category validation                                                 */
/* -------------------------------------------------------------------------- */

describe('updateCategorySchema', () => {
  it('accepts a name-only update', () => {
    const result = updateCategorySchema.safeParse({
      name: 'Updated Rackets',
    });

    expect(result.success).toBe(true);
  });

  it('accepts an explicit null parent ID', () => {
    const result = updateCategorySchema.safeParse({
      parentId: null,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a description update', () => {
    const result = updateCategorySchema.safeParse({
      description: 'Equipment for tennis players.',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty update object', () => {
    const result = updateCategorySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects an invalid parent ID', () => {
    const result = updateCategorySchema.safeParse({
      parentId: 'invalid-id',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected update fields', () => {
    const result = updateCategorySchema.safeParse({
      name: 'Updated Rackets',
      createdBy: '507f1f77bcf86cd799439011',
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Update category parameter validation                                       */
/* -------------------------------------------------------------------------- */

describe('updateCategoryParamsSchema', () => {
  it('accepts a valid category ID', () => {
    const result = updateCategoryParamsSchema.safeParse({
      categoryId: '507f1f77bcf86cd799439011',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid category ID', () => {
    const result = updateCategoryParamsSchema.safeParse({
      categoryId: 'invalid-id',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing category ID', () => {
    const result = updateCategoryParamsSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
