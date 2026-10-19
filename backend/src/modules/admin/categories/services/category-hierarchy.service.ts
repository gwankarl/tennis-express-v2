import { Types } from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { CategoryModel } from '../../../shared/categories/models/category.model.js';

/* -------------------------------------------------------------------------- */
/* Category hierarchy constants                                               */
/* -------------------------------------------------------------------------- */

const MAX_CATEGORY_DEPTH = 3;

/* -------------------------------------------------------------------------- */
/* Category hierarchy service                                                 */
/* -------------------------------------------------------------------------- */

export class CategoryHierarchyService {
  /**
   * Validates a proposed parent relationship before a category is created
   * or updated.
   *
   * Root categories have no parent and are always valid at this stage.
   * Non-root categories must reference an existing parent, cannot create a
   * cycle, and cannot exceed the configured maximum hierarchy depth.
   */
  static async validateParent(input: {
    parentId: string | Types.ObjectId | null;
    categoryId?: string | Types.ObjectId;
  }): Promise<void> {
    const { parentId, categoryId } = input;

    if (parentId === null) {
      return;
    }

    if (!Types.ObjectId.isValid(parentId)) {
      throw new AppError({
        statusCode: 400,
        code: 'CATEGORY_INVALID_PARENT_ID',
        message: 'The supplied parent category ID is invalid.',
      });
    }

    const parentObjectId =
      parentId instanceof Types.ObjectId
        ? parentId
        : new Types.ObjectId(parentId);

    const currentCategoryId =
      categoryId === undefined
        ? null
        : categoryId instanceof Types.ObjectId
          ? categoryId
          : Types.ObjectId.isValid(categoryId)
            ? new Types.ObjectId(categoryId)
            : null;

    if (categoryId !== undefined && currentCategoryId === null) {
      throw new AppError({
        statusCode: 400,
        code: 'CATEGORY_INVALID_CATEGORY_ID',
        message: 'The category ID being updated is invalid.',
      });
    }

    if (
      currentCategoryId !== null &&
      parentObjectId.equals(currentCategoryId)
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'CATEGORY_SELF_PARENT',
        message: 'A category cannot be its own parent.',
      });
    }

    let cursor: Types.ObjectId | null = parentObjectId;
    let depth = 0;

    const visitedIds = new Set<string>();

    while (cursor !== null) {
      const cursorId = cursor.toString();

      if (visitedIds.has(cursorId)) {
        throw new AppError({
          statusCode: 409,
          code: 'CATEGORY_EXISTING_HIERARCHY_CYCLE',
          message: 'The existing category hierarchy contains a cycle.',
        });
      }

      visitedIds.add(cursorId);

      if (currentCategoryId !== null && cursor.equals(currentCategoryId)) {
        throw new AppError({
          statusCode: 400,
          code: 'CATEGORY_HIERARCHY_CYCLE',
          message: 'This parent assignment would create a category cycle.',
        });
      }

      const ancestor = await CategoryModel.findById(cursor)
        .select('_id parentId')
        .lean()
        .exec();

      if (ancestor === null) {
        if (depth === 0) {
          throw new AppError({
            statusCode: 404,
            code: 'CATEGORY_PARENT_NOT_FOUND',
            message: 'The specified parent category does not exist.',
          });
        }

        throw new AppError({
          statusCode: 409,
          code: 'CATEGORY_BROKEN_HIERARCHY',
          message: 'The existing category hierarchy contains a missing parent.',
        });
      }

      depth += 1;

      if (depth >= MAX_CATEGORY_DEPTH) {
        throw new AppError({
          statusCode: 400,
          code: 'CATEGORY_MAX_DEPTH_EXCEEDED',
          message: `Categories cannot exceed ${MAX_CATEGORY_DEPTH} levels.`,
        });
      }

      cursor = ancestor.parentId;
    }
  }
}
