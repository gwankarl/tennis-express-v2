import mongoose from 'mongoose';

import { ProductViewActivityModel } from '../models/product-view-activity.model.js';
import { ProductModel } from '../models/product.model.js';
import { ProductViewIdentityService } from './product-view-identity.service.js';
import { StoreModel } from '../../stores/models/store.model.js';
import { UserModel } from '../../users/models/user.model.js';

import type { Request, Response } from 'express';

const automatedTrafficPattern =
  /bot|crawler|spider|slurp|headless|lighthouse|pagespeed/i;

/** Records qualifying public product views with daily visitor deduplication. */
export class ProductViewActivityService {
  constructor(
    private readonly identityService = new ProductViewIdentityService(),
  ) {}

  async recordView(
    productId: string,
    req: Request,
    res: Response,
    authenticatedUserId?: string,
  ): Promise<{ recorded: boolean }> {
    if (!mongoose.isValidObjectId(productId)) {
      return { recorded: false };
    }

    const userAgent = req.get('user-agent') ?? '';

    if (automatedTrafficPattern.test(userAgent)) {
      return { recorded: false };
    }

    const product = await ProductModel.findOne({
      _id: productId,
      moderationStatus: 'approved',
      publicationStatus: 'published',
      publishedAt: { $ne: null },
    })
      .select('sellerId storeId')
      .lean()
      .exec();

    if (!product) {
      return { recorded: false };
    }

    /* Exclude the seller's own product views. */
    if (
      authenticatedUserId &&
      product.sellerId.toString() === authenticatedUserId
    ) {
      return { recorded: false };
    }

    const [store, seller] = await Promise.all([
      StoreModel.findOne({
        _id: product.storeId,
        sellerId: product.sellerId,
        status: 'active',
      })
        .select('_id')
        .lean()
        .exec(),
      UserModel.findOne({
        _id: product.sellerId,
        status: 'active',
        deletedAt: null,
        roles: { $in: ['seller', 'both'] },
      })
        .select('_id')
        .lean()
        .exec(),
    ]);

    if (!store || !seller) {
      return { recorded: false };
    }

    const identity = this.identityService.getVisitorIdentity(
      req,
      res,
      authenticatedUserId,
    );
    const now = new Date();

    try {
      await ProductViewActivityModel.create({
        productId: product._id,
        visitorHash: identity.visitorHash,
        identityType: identity.identityType,
        viewDate: now.toISOString().slice(0, 10),
        viewedAt: now,
      });

      return { recorded: true };
    } catch (error) {
      /* A duplicate means this visitor already viewed this product today. */
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        return { recorded: false };
      }

      throw error;
    }
  }
}

export const productViewActivityService = new ProductViewActivityService();
