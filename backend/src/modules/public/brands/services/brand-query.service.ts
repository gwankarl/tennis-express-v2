import { BrandModel } from '../../../shared/brands/models/brand.model.js';

/** Provides read operations for public brand browsing. */
export class BrandQueryService {
  /**
   * Retrieves active brands ordered alphabetically by name.
   * Audit fields are excluded from the returned documents.
   */
  static async getActiveBrands() {
    return BrandModel.find({ status: 'active' })
      .select('-createdBy -updatedBy')
      .sort({ name: 1 });
  }
}
