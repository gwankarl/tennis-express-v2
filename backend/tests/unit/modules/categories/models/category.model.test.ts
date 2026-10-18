import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { CategoryModel } from '../../../../../src/modules/categories/models/category.model.js';

describe('CategoryModel', () => {
  const administratorId = new mongoose.Types.ObjectId();

  const validCategory = () => ({
    name: 'Tennis Rackets',
    slug: 'tennis-rackets',
    parentId: null,
    createdBy: administratorId,
    updatedBy: administratorId,
  });

  it('applies the expected defaults', () => {
    const category = new CategoryModel(validCategory());

    expect(category.parentId).toBeNull();
    expect(category.description).toBeNull();
    expect(category.attributes).toEqual([]);
    expect(category.status).toBe('active');
    expect(category.sortOrder).toBe(0);
  });

  it('accepts a valid category with a select attribute', async () => {
    const category = new CategoryModel({
      ...validCategory(),
      attributes: [
        {
          name: 'Grip Size',
          slug: 'grip-size',
          type: 'select',
          required: true,
          options: ['Grip 2', 'Grip 3', 'Grip 4'],
        },
      ],
    });

    await expect(category.validate()).resolves.toBeUndefined();
  });

  it('rejects a select attribute without options', async () => {
    const category = new CategoryModel({
      ...validCategory(),
      attributes: [
        {
          name: 'Grip Size',
          slug: 'grip-size',
          type: 'select',
          required: true,
          options: [],
        },
      ],
    });

    await expect(category.validate()).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('rejects options on a non-select attribute', async () => {
    const category = new CategoryModel({
      ...validCategory(),
      attributes: [
        {
          name: 'Head Size',
          slug: 'head-size',
          type: 'number',
          required: false,
          options: ['100'],
        },
      ],
    });

    await expect(category.validate()).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('rejects an unsupported attribute type', async () => {
    const category = new CategoryModel({
      ...validCategory(),
      attributes: [
        {
          name: 'Grip Size',
          slug: 'grip-size',
          type: 'colour',
          required: false,
          options: [],
        },
      ],
    });

    await expect(category.validate()).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('rejects a category without its required administrator references', async () => {
    const category = new CategoryModel({
      name: 'Tennis Rackets',
      slug: 'tennis-rackets',
    });

    await expect(category.validate()).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('rejects a negative sort order', async () => {
    const category = new CategoryModel({
      ...validCategory(),
      sortOrder: -1,
    });

    await expect(category.validate()).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });
});
