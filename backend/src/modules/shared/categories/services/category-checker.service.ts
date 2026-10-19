import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';

import { CategoryModel } from '../../../shared/categories/models/category.model.js';

/** Validates category selections made by marketplace workflows. */
export class CategoryCheckerService {
  /**
   * Ensures every selected category exists, is active,
   * and has only active ancestors.
   */
  async validateCategories(categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) {
      throw new AppError({
        statusCode: 400,
        code: 'SELLER_APPLICATION_CATEGORIES_REQUIRED',
        message: 'At least one product category must be selected.',
      });
    }

    const invalidId = categoryIds.some(
      (categoryId) => !mongoose.isValidObjectId(categoryId),
    );

    if (invalidId) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_CATEGORY_ID',
        message: 'One or more selected category IDs are invalid.',
      });
    }

    const categories = await CategoryModel.find({})
      .select('_id parentId status')
      .exec();

    const categoriesById = new Map(
      categories.map((category) => [category._id.toString(), category]),
    );

    for (const categoryId of categoryIds) {
      const category = categoriesById.get(
        new mongoose.Types.ObjectId(categoryId).toString(),
      );

      if (!category) {
        throw new AppError({
          statusCode: 400,
          code: 'CATEGORY_NOT_FOUND',
          message: 'One or more selected categories do not exist.',
        });
      }

      if (category.status !== 'active') {
        throw new AppError({
          statusCode: 400,
          code: 'CATEGORY_NOT_ACTIVE',
          message: 'One or more selected categories are inactive.',
        });
      }

      let parentId = category.parentId;

      while (parentId) {
        const parent = categoriesById.get(parentId.toString());

        if (!parent) {
          throw new AppError({
            statusCode: 400,
            code: 'CATEGORY_INVALID_HIERARCHY',
            message: 'A selected category has an invalid parent hierarchy.',
          });
        }

        if (parent.status !== 'active') {
          throw new AppError({
            statusCode: 400,
            code: 'CATEGORY_ANCESTOR_NOT_ACTIVE',
            message: 'A selected category has an inactive ancestor.',
          });
        }

        parentId = parent.parentId;
      }
    }
  }
}
