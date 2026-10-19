import { ProductModel } from '../../../shared/products/models/product.model.js';

export class AdminProductRetrievalService {
  async getPendingProducts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const filter = {
      moderationStatus: 'pending' as const,
      publicationStatus: 'draft' as const,
      submittedAt: { $ne: null },
    };

    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ submittedAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}

export const adminProductRetrievalService = new AdminProductRetrievalService();
