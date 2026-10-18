import { Types } from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';
import { BrandModel } from '../models/brand.model.js';

import type { Brand } from '../types/brand.types.js';

import type {
  CreateBrandRequest,
  UpdateBrandRequest,
} from '../validations/brand.validation.js';

/* -------------------------------------------------------------------------- */
/* Service input types                                                        */
/* -------------------------------------------------------------------------- */

export interface CreateBrandInput extends CreateBrandRequest {
  createdBy: Types.ObjectId;
}

export interface UpdateBrandInput {
  brandId: Types.ObjectId;
  updatedBy: Types.ObjectId;
  changes: UpdateBrandRequest;
}

/* -------------------------------------------------------------------------- */
/* Brand management service                                                   */
/* -------------------------------------------------------------------------- */

export class BrandManagementService {
  /* ------------------------------------------------------------------------ */
  /* Create a brand                                                           */
  /* ------------------------------------------------------------------------ */

  static async create(input: CreateBrandInput): Promise<Brand> {
    const name = input.name;
    const baseSlug = this.createSlug(name);

    if (!baseSlug) {
      throw new AppError({
        statusCode: 400,
        code: 'BRAND_INVALID_NAME',
        message: 'The brand name cannot be converted into a valid URL slug.',
      });
    }

    const slug = await this.generateUniqueSlug(baseSlug);

    const brand = await BrandModel.create({
      name,
      slug,
      description: input.description ?? null,
      logo: input.logo ?? null,
      status: 'active',
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });

    return brand.toObject() as Brand;
  }

  /* ------------------------------------------------------------------------ */
  /* Update a brand                                                           */
  /* ------------------------------------------------------------------------ */

  static async update(input: UpdateBrandInput): Promise<Brand> {
    const brand = await BrandModel.findById(input.brandId).exec();

    if (!brand) {
      throw new AppError({
        statusCode: 404,
        code: 'BRAND_NOT_FOUND',
        message: 'The brand does not exist.',
      });
    }

    const changes = input.changes;
    const updates: Record<string, unknown> = {};

    if (changes.name !== undefined && changes.name !== brand.name) {
      const baseSlug = this.createSlug(changes.name);

      if (!baseSlug) {
        throw new AppError({
          statusCode: 400,
          code: 'BRAND_INVALID_NAME',
          message: 'The brand name cannot be converted into a valid URL slug.',
        });
      }

      updates.name = changes.name;
      updates.slug = await this.generateUniqueSlug(baseSlug, brand._id);
    } else if (changes.name !== undefined) {
      updates.name = changes.name;
    }

    if (changes.description !== undefined) {
      updates.description = changes.description;
    }

    if (changes.logo !== undefined) {
      updates.logo = changes.logo;
    }

    updates.updatedBy = input.updatedBy;

    brand.set(updates);

    await brand.save();

    return brand.toObject() as Brand;
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
    excludeBrandId?: Types.ObjectId,
  ): Promise<string> {
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
      const query: Record<string, unknown> = { slug };

      if (excludeBrandId) {
        query._id = { $ne: excludeBrandId };
      }

      if (!(await BrandModel.exists(query))) {
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
