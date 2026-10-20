import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';

/**
 * Retrieves products intended for public marketplace access.
 */
export class ProductQueryService {
  /**
   * Retrieves a publicly visible product by its ID.
   *
   * A product is visible only when it is approved and published,
   * its store is active, and its seller account is active.
   */
  async getPublicProductById(productId: string) {
    const product = await ProductModel.findOne({
      _id: productId,
      moderationStatus: 'approved',
      publicationStatus: 'published',
      publishedAt: { $ne: null },
    })
      .select(
        'storeId sellerId name slug description categoryId brandId condition attributes images publishedAt',
      )
      .lean()
      .exec();

    if (!product) {
      throw this.createPublicProductNotFoundError();
    }

    const store = await StoreModel.findOne({
      _id: product.storeId,
      sellerId: product.sellerId,
      status: 'active',
    })
      .select('name slug')
      .lean()
      .exec();

    if (!store) {
      throw this.createPublicProductNotFoundError();
    }

    const seller = await UserModel.findOne({
      _id: product.sellerId,
      status: 'active',
      deletedAt: null,
      roles: { $in: ['seller', 'both'] },
    })
      .select('_id')
      .lean()
      .exec();

    if (!seller) {
      throw this.createPublicProductNotFoundError();
    }

    return {
      id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      categoryId: product.categoryId,
      brandId: product.brandId,
      condition: product.condition,
      attributes: product.attributes,
      images: product.images,
      publishedAt: product.publishedAt,
      store: {
        name: store.name,
        slug: store.slug,
      },
    };
  }

  /**
   * Uses the same response for missing and non-public products.
   */
  private createPublicProductNotFoundError() {
    return new AppError({
      statusCode: 404,
      code: 'PUBLIC_PRODUCT_NOT_FOUND',
      message: 'The requested product could not be found.',
    });
  }
}

export const productQueryService = new ProductQueryService();
