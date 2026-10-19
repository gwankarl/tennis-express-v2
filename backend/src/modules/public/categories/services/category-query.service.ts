import { CategoryModel } from '../../../shared/categories/models/category.model.js';

/** Provides read operations for public category browsing. */
export class CategoryQueryService {
  /**
   * Retrieves categories that are active and have no inactive ancestors.
   * Results are flat, unpaginated, and ordered by sort order then name.
   */
  static async getActiveCategories() {
    /*
     * Load all categories so ancestor visibility can be checked,
     * including ancestors that are currently inactive.
     * Audit fields are excluded from the returned category documents.
     */
    const categories = await CategoryModel.find({})
      .select('-createdBy -updatedBy')
      .sort({ sortOrder: 1, name: 1 });

    const categoriesById = new Map(
      categories.map((category) => [category._id.toString(), category]),
    );

    return categories.filter((category) => {
      if (category.status !== 'active') {
        return false;
      }

      let parentId = category.parentId;

      /*
       * A category is visible only when every ancestor exists
       * and is active. This check applies recursively at all levels.
       */
      while (parentId) {
        const parent = categoriesById.get(parentId.toString());

        if (!parent || parent.status !== 'active') {
          return false;
        }

        parentId = parent.parentId;
      }

      return true;
    });
  }
}
