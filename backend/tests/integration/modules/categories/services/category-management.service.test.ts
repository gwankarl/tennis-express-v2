import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { CategoryModel } from '../../../../../src/modules/categories/models/category.model.js';
import { CategoryManagementService } from '../../../../../src/modules/categories/services/category-management.service.js';

/* -------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* -------------------------------------------------------------------------- */

describe('CategoryManagementService integration', () => {
  const administratorId = new mongoose.Types.ObjectId();
  const secondAdministratorId = new mongoose.Types.ObjectId();

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

  /* ------------------------------------------------------------------------ */
  /* Category creation                                                        */
  /* ------------------------------------------------------------------------ */

  describe('create', () => {
    it('creates a root category with default values', async () => {
      const category = await CategoryManagementService.create({
        name: 'Tennis Equipment',
        createdBy: administratorId,
      });

      expect(category.name).toBe('Tennis Equipment');
      expect(category.slug).toBe('tennis-equipment');
      expect(category.parentId).toBeNull();
      expect(category.description).toBeNull();
      expect(category.attributes).toEqual([]);
      expect(category.status).toBe('active');
      expect(category.sortOrder).toBe(0);
      expect(category.createdBy.toString()).toBe(administratorId.toString());
      expect(category.updatedBy.toString()).toBe(administratorId.toString());

      const savedCategory = await CategoryModel.findById(category._id);

      expect(savedCategory).not.toBeNull();
    });

    it('creates a child category under an existing parent', async () => {
      const parent = await createCategory({
        name: 'Tennis Equipment',
      });

      const category = await CategoryManagementService.create({
        name: 'Tennis Rackets',
        parentId: parent._id.toString(),
        createdBy: administratorId,
      });

      expect(category.parentId?.toString()).toBe(parent._id.toString());
      expect(category.slug).toBe('tennis-rackets');
    });

    it('trims the category name before saving', async () => {
      const category = await CategoryManagementService.create({
        name: '  Tennis Rackets  ',
        createdBy: administratorId,
      });

      expect(category.name).toBe('Tennis Rackets');
      expect(category.slug).toBe('tennis-rackets');
    });

    it('generates a numeric suffix when the slug already exists', async () => {
      await createCategory({
        name: 'Tennis Rackets',
      });

      const category = await CategoryManagementService.create({
        name: 'Tennis Rackets',
        createdBy: administratorId,
      });

      expect(category.slug).toBe('tennis-rackets-2');
    });

    it('normalizes accented characters when generating a slug', async () => {
      const category = await CategoryManagementService.create({
        name: 'Équipement de Tennis',
        createdBy: administratorId,
      });

      expect(category.slug).toBe('equipement-de-tennis');
    });

    it('rejects a name that cannot produce a valid slug', async () => {
      await expect(
        CategoryManagementService.create({
          name: '🎾',
          createdBy: administratorId,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CATEGORY_INVALID_NAME',
      });
    });

    it('rejects a parent category that does not exist', async () => {
      const missingParentId = new mongoose.Types.ObjectId();

      await expect(
        CategoryManagementService.create({
          name: 'Tennis Rackets',
          parentId: missingParentId.toString(),
          createdBy: administratorId,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CATEGORY_PARENT_NOT_FOUND',
      });
    });

    it('rejects creation beyond the maximum hierarchy depth', async () => {
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
        CategoryManagementService.create({
          name: 'Competition Rackets',
          parentId: grandchild._id.toString(),
          createdBy: administratorId,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CATEGORY_MAX_DEPTH_EXCEEDED',
      });
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Category editing                                                         */
  /* ------------------------------------------------------------------------ */

  describe('update', () => {
    it('updates the category name and regenerates its slug', async () => {
      const category = await createCategory({
        name: 'Tennis Rackets',
      });

      const updated = await CategoryManagementService.update({
        categoryId: category._id,
        updatedBy: secondAdministratorId,
        changes: {
          name: 'Professional Rackets',
        },
      });

      expect(updated.name).toBe('Professional Rackets');
      expect(updated.slug).toBe('professional-rackets');
      expect(updated.updatedBy.toString()).toBe(
        secondAdministratorId.toString(),
      );
      expect(updated.createdBy.toString()).toBe(administratorId.toString());
    });

    it('generates a unique slug when an updated name collides', async () => {
      await createCategory({
        name: 'Professional Rackets',
      });

      const category = await createCategory({
        name: 'Tennis Rackets',
      });

      const updated = await CategoryManagementService.update({
        categoryId: category._id,
        updatedBy: secondAdministratorId,
        changes: {
          name: 'Professional Rackets',
        },
      });

      expect(updated.slug).toBe('professional-rackets-2');
    });

    it('updates the description without changing the slug', async () => {
      const category = await createCategory({
        name: 'Tennis Rackets',
      });

      const updated = await CategoryManagementService.update({
        categoryId: category._id,
        updatedBy: secondAdministratorId,
        changes: {
          description: 'Rackets for recreational and competitive players.',
        },
      });

      expect(updated.description).toBe(
        'Rackets for recreational and competitive players.',
      );
      expect(updated.slug).toBe('tennis-rackets');
    });

    it('allows a category to become a root category', async () => {
      const parent = await createCategory({
        name: 'Tennis Equipment',
      });

      const category = await createCategory({
        name: 'Tennis Rackets',
        parentId: parent._id,
      });

      const updated = await CategoryManagementService.update({
        categoryId: category._id,
        updatedBy: secondAdministratorId,
        changes: {
          parentId: null,
        },
      });

      expect(updated.parentId).toBeNull();
    });

    it('allows moving a category under another valid parent', async () => {
      const firstParent = await createCategory({
        name: 'Tennis Equipment',
      });

      const secondParent = await createCategory({
        name: 'Training Equipment',
      });

      const category = await createCategory({
        name: 'Tennis Rackets',
        parentId: firstParent._id,
      });

      const updated = await CategoryManagementService.update({
        categoryId: category._id,
        updatedBy: secondAdministratorId,
        changes: {
          parentId: secondParent._id.toString(),
        },
      });

      expect(updated.parentId?.toString()).toBe(secondParent._id.toString());
    });

    it('rejects updating a category that does not exist', async () => {
      const missingCategoryId = new mongoose.Types.ObjectId();

      await expect(
        CategoryManagementService.update({
          categoryId: missingCategoryId,
          updatedBy: secondAdministratorId,
          changes: {
            name: 'Professional Rackets',
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CATEGORY_NOT_FOUND',
      });
    });

    it('rejects assigning a category as its own parent', async () => {
      const category = await createCategory({
        name: 'Tennis Rackets',
      });

      await expect(
        CategoryManagementService.update({
          categoryId: category._id,
          updatedBy: secondAdministratorId,
          changes: {
            parentId: category._id.toString(),
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CATEGORY_SELF_PARENT',
      });
    });

    it('rejects a move that would make descendants exceed three levels', async () => {
      const destinationRoot = await createCategory({
        name: 'Destination Equipment',
      });

      const destinationChild = await createCategory({
        name: 'Destination Rackets',
        parentId: destinationRoot._id,
      });

      const sourceRoot = await createCategory({
        name: 'Source Equipment',
      });

      const sourceChild = await createCategory({
        name: 'Source Rackets',
        parentId: sourceRoot._id,
      });

      await createCategory({
        name: 'Source Junior Rackets',
        parentId: sourceChild._id,
      });

      await expect(
        CategoryManagementService.update({
          categoryId: sourceRoot._id,
          updatedBy: secondAdministratorId,
          changes: {
            parentId: destinationChild._id.toString(),
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CATEGORY_MAX_DEPTH_EXCEEDED',
      });
    });

    it('preserves createdBy when editing a category', async () => {
      const category = await createCategory({
        name: 'Tennis Rackets',
      });

      const updated = await CategoryManagementService.update({
        categoryId: category._id,
        updatedBy: secondAdministratorId,
        changes: {
          sortOrder: 5,
        },
      });

      expect(updated.createdBy.toString()).toBe(administratorId.toString());
      expect(updated.updatedBy.toString()).toBe(
        secondAdministratorId.toString(),
      );
      expect(updated.sortOrder).toBe(5);
    });
  });
});
