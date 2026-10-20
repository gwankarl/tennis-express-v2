import { CategoryModel } from '../../../shared/categories/models/category.model.js';

import type { Category } from '../../../shared/categories/types/category.types.js';

/** Represents a public category and its visible subcategories. */
export interface PublicCategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  attributes: Category['attributes'];
  children: PublicCategoryTreeNode[];
}

/** Provides read operations for public category browsing. */
export class CategoryQueryService {
  /**
   * Retrieves active categories whose ancestors are also active,
   * then arranges them into a recursively nested category tree.
   */
  static async getActiveCategories(): Promise<PublicCategoryTreeNode[]> {
    /*
     * Load categories so visibility can be checked against every ancestor,
     * including ancestors that are inactive.
     */
    const categories = await CategoryModel.find({})
      .select('_id name slug parentId description attributes status sortOrder')
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec();

    const categoriesById = new Map(
      categories.map((category) => [category._id.toString(), category]),
    );

    const visibleCategories = categories.filter((category) => {
      if (category.status !== 'active') {
        return false;
      }

      let parentId = category.parentId;

      /* A category is visible only when every ancestor is active and exists. */
      while (parentId) {
        const parent = categoriesById.get(parentId.toString());

        if (!parent || parent.status !== 'active') {
          return false;
        }

        parentId = parent.parentId;
      }

      return true;
    });

    const nodesById = new Map<string, PublicCategoryTreeNode>();

    for (const category of visibleCategories) {
      nodesById.set(category._id.toString(), {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        parentId: category.parentId?.toString() ?? null,
        description: category.description ?? null,
        sortOrder: category.sortOrder,
        attributes: category.attributes,
        children: [],
      });
    }

    const rootCategories: PublicCategoryTreeNode[] = [];

    for (const category of visibleCategories) {
      const node = nodesById.get(category._id.toString())!;
      const parentId = category.parentId?.toString();

      if (!parentId) {
        rootCategories.push(node);
        continue;
      }

      const parent = nodesById.get(parentId);

      if (parent) {
        parent.children.push(node);
      }
    }

    return rootCategories;
  }
}
