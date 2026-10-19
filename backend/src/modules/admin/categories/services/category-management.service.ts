import { Types } from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { CategoryModel } from '../../../shared/categories/models/category.model.js';
import { CategoryHierarchyService } from './category-hierarchy.service.js';

import type {
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../validations/category.validation.js';
import type { Category } from '../../../shared/categories/types/category.types.js';

/* -------------------------------------------------------------------------- */
/* Service input types                                                        */
/* -------------------------------------------------------------------------- */

export interface CreateCategoryInput extends CreateCategoryRequest {
  createdBy: Types.ObjectId;
}

export interface UpdateCategoryInput {
  categoryId: Types.ObjectId;
  updatedBy: Types.ObjectId;
  changes: UpdateCategoryRequest;
}

/* -------------------------------------------------------------------------- */
/* Category management service                                                */
/* -------------------------------------------------------------------------- */

export class CategoryManagementService {
  /* ------------------------------------------------------------------------ */
  /* Create a category                                                        */
  /* ------------------------------------------------------------------------ */

  static async create(input: CreateCategoryInput): Promise<Category> {
    const name = input.name;
    const baseSlug = this.createSlug(name);

    if (!baseSlug) {
      throw new AppError({
        statusCode: 400,
        code: 'CATEGORY_INVALID_NAME',
        message: 'The category name cannot be converted into a valid URL slug.',
      });
    }

    const parentId = input.parentId ? new Types.ObjectId(input.parentId) : null;

    await CategoryHierarchyService.validateParent({ parentId });

    const slug = await this.generateUniqueSlug(baseSlug);

    const category = await CategoryModel.create({
      name,
      slug,
      parentId,
      description: input.description ?? null,
      attributes: input.attributes ?? [],
      status: input.status ?? 'active',
      sortOrder: input.sortOrder ?? 0,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });

    return category.toObject() as Category;
  }

  /* ------------------------------------------------------------------------ */
  /* Update a category                                                        */
  /* ------------------------------------------------------------------------ */

  static async update(input: UpdateCategoryInput): Promise<Category> {
    const category = await CategoryModel.findById(input.categoryId).exec();

    if (!category) {
      throw new AppError({
        statusCode: 404,
        code: 'CATEGORY_NOT_FOUND',
        message: 'The category does not exist.',
      });
    }

    const changes = input.changes;
    const updates: Record<string, unknown> = {};

    if (changes.name !== undefined && changes.name !== category.name) {
      const baseSlug = this.createSlug(changes.name);

      if (!baseSlug) {
        throw new AppError({
          statusCode: 400,
          code: 'CATEGORY_INVALID_NAME',
          message:
            'The category name cannot be converted into a valid URL slug.',
        });
      }

      updates.name = changes.name;
      updates.slug = await this.generateUniqueSlug(baseSlug, category._id);
    } else if (changes.name !== undefined) {
      updates.name = changes.name;
    }

    if (changes.parentId !== undefined) {
      const parentId = changes.parentId
        ? new Types.ObjectId(changes.parentId)
        : null;

      await CategoryHierarchyService.validateParent({
        parentId,
        categoryId: category._id,
      });

      await this.validateDescendantDepth(category._id, parentId);

      updates.parentId = parentId;
    }

    if (changes.description !== undefined) {
      updates.description = changes.description;
    }

    if (changes.attributes !== undefined) {
      updates.attributes = changes.attributes;
    }

    if (changes.status !== undefined) {
      updates.status = changes.status;
    }

    if (changes.sortOrder !== undefined) {
      updates.sortOrder = changes.sortOrder;
    }

    updates.updatedBy = input.updatedBy;

    category.set(updates);

    await category.save();

    return category.toObject() as Category;
  }

  /* ------------------------------------------------------------------------ */
  /* Validate descendant depth                                                */
  /* ------------------------------------------------------------------------ */

  /**
   * Ensures a category move does not push its descendants beyond three levels.
   */
  private static async validateDescendantDepth(
    categoryId: Types.ObjectId,
    proposedParentId: Types.ObjectId | null,
  ): Promise<void> {
    const maxCategoryDepth = 3;

    let proposedParentDepth = 0;
    let cursor = proposedParentId;

    while (cursor !== null) {
      proposedParentDepth += 1;

      const parent = await CategoryModel.findById(cursor)
        .select('_id parentId')
        .lean()
        .exec();

      if (!parent) {
        throw new AppError({
          statusCode: 409,
          code: 'CATEGORY_BROKEN_HIERARCHY',
          message: 'The existing category hierarchy contains a missing parent.',
        });
      }

      cursor = parent.parentId;
    }

    const descendants = await CategoryModel.find({
      parentId: categoryId,
    })
      .select('_id')
      .lean()
      .exec();

    let frontier = descendants.map((descendant) => ({
      id: descendant._id,
      depth: 1,
    }));

    let maximumRelativeDepth = 0;

    while (frontier.length > 0) {
      const current = frontier.shift();

      if (!current) {
        continue;
      }

      maximumRelativeDepth = Math.max(maximumRelativeDepth, current.depth);

      const children = await CategoryModel.find({
        parentId: current.id,
      })
        .select('_id')
        .lean()
        .exec();

      frontier.push(
        ...children.map((child) => ({
          id: child._id,
          depth: current.depth + 1,
        })),
      );
    }

    if (proposedParentDepth + 1 + maximumRelativeDepth > maxCategoryDepth) {
      throw new AppError({
        statusCode: 400,
        code: 'CATEGORY_MAX_DEPTH_EXCEEDED',
        message:
          'Moving this category would cause its descendants to exceed the maximum hierarchy depth.',
      });
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Slug generation                                                          */
  /* ------------------------------------------------------------------------ */

  private static createSlug(name: string): string {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
      .replace(/-+$/g, '');
  }

  private static async generateUniqueSlug(
    baseSlug: string,
    excludeCategoryId?: Types.ObjectId,
  ): Promise<string> {
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
      const query: Record<string, unknown> = { slug };

      if (excludeCategoryId) {
        query._id = { $ne: excludeCategoryId };
      }

      if (!(await CategoryModel.exists(query))) {
        return slug;
      }

      const suffixText = `-${suffix}`;
      const trimmedBase = baseSlug
        .slice(0, 120 - suffixText.length)
        .replace(/-+$/g, '');

      slug = `${trimmedBase}${suffixText}`;
      suffix += 1;
    }
  }
}
