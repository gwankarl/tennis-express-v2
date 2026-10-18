import { Types } from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';
import { BrandModel } from '../models/brand.model.js';

import type { Brand } from '../types/brand.types.js';

/* -------------------------------------------------------------------------- */
/* Service input types                                                        */
/* -------------------------------------------------------------------------- */

export interface UpdateBrandStatusInput {
  brandId: Types.ObjectId;
  updatedBy: Types.ObjectId;
}

/* -------------------------------------------------------------------------- */
/* Brand status service                                                       */
/* -------------------------------------------------------------------------- */

export class BrandStatusService {
  /* ------------------------------------------------------------------------ */
  /* Activate a brand                                                         */
  /* ------------------------------------------------------------------------ */

  static async activate(input: UpdateBrandStatusInput): Promise<Brand> {
    return this.updateStatus({
      ...input,
      status: 'active',
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Deactivate a brand                                                       */
  /* ------------------------------------------------------------------------ */

  static async deactivate(input: UpdateBrandStatusInput): Promise<Brand> {
    return this.updateStatus({
      ...input,
      status: 'inactive',
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Update brand status                                                      */
  /* ------------------------------------------------------------------------ */

  private static async updateStatus(
    input: UpdateBrandStatusInput & {
      status: 'active' | 'inactive';
    },
  ): Promise<Brand> {
    const brand = await BrandModel.findById(input.brandId).exec();

    if (!brand) {
      throw new AppError({
        statusCode: 404,
        code: 'BRAND_NOT_FOUND',
        message: 'The brand does not exist.',
      });
    }

    if (brand.status === input.status) {
      return brand.toObject() as Brand;
    }

    brand.status = input.status;
    brand.updatedBy = input.updatedBy;

    await brand.save();

    return brand.toObject() as Brand;
  }
}
