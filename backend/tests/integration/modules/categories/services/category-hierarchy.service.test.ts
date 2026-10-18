import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { CategoryModel } from '../../../../../src/modules/categories/models/category.model.js';
import { CategoryHierarchyService } from '../../../../../src/modules/categories/services/category-hierarchy.service.js';

describe('CategoryHierarchyService integration', () => {
  const administratorId = new mongoose.Types.ObjectId();

  async function createCategory(input: {
    name: string;
    parentId?: mongoose.Types.ObjectId | null;
  }) {
    return CategoryModel.create({
      name: input.name,
      slug: input.name.toLowerCase().replace(/\s+/g, '-'),
      parentId: input.parentId ?? null,
      createdBy: administratorId,
      updatedBy: administratorId,
    });
  }

  it('allows a root category', async () => {
    await expect(
      CategoryHierarchyService.validateParent({
        parentId: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a child category under an existing root', async () => {
    const root = await createCategory({
      name: 'Tennis Equipment',
    });

    await expect(
      CategoryHierarchyService.validateParent({
        parentId: root._id,
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a third-level category under a second-level parent', async () => {
    const root = await createCategory({
      name: 'Equipment',
    });

    const child = await createCategory({
      name: 'Rackets',
      parentId: root._id,
    });

    await expect(
      CategoryHierarchyService.validateParent({
        parentId: child._id,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a parent category that does not exist', async () => {
    const missingParentId = new mongoose.Types.ObjectId();

    await expect(
      CategoryHierarchyService.validateParent({
        parentId: missingParentId,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'CATEGORY_PARENT_NOT_FOUND',
    });
  });

  it('rejects an invalid parent ID', async () => {
    await expect(
      CategoryHierarchyService.validateParent({
        parentId: 'not-a-valid-object-id',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_INVALID_PARENT_ID',
    });
  });

  it('rejects a category as its own parent', async () => {
    const category = await createCategory({
      name: 'Tennis Balls',
    });

    await expect(
      CategoryHierarchyService.validateParent({
        categoryId: category._id,
        parentId: category._id,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_SELF_PARENT',
    });
  });

  it('rejects an assignment that would create an indirect cycle', async () => {
    const root = await createCategory({
      name: 'Equipment',
    });

    const child = await createCategory({
      name: 'Rackets',
      parentId: root._id,
    });

    await expect(
      CategoryHierarchyService.validateParent({
        categoryId: root._id,
        parentId: child._id,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_HIERARCHY_CYCLE',
    });
  });

  it('rejects a fourth-level category', async () => {
    const root = await createCategory({
      name: 'Equipment',
    });

    const child = await createCategory({
      name: 'Rackets',
      parentId: root._id,
    });

    const grandchild = await createCategory({
      name: 'Junior Rackets',
      parentId: child._id,
    });

    await expect(
      CategoryHierarchyService.validateParent({
        parentId: grandchild._id,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_MAX_DEPTH_EXCEEDED',
    });
  });
});
