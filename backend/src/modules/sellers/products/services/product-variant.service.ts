import { Types } from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import { ProductVariantModel } from '../../../shared/products/models/product-variant.model.js';
import { variantPricingService } from '../../../shared/products/services/variant-pricing.service.js';

import type { VariantDiscount } from '../../../shared/products/types/product-variant.types.js';
import type {
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from '../validations/variants/product-variant.schema.js';

/** Manages seller-owned product variants and their purchasable state. */
export class ProductVariantService {
  /**
   * Creates a variant for a product owned by the authenticated seller.
   */
  async createVariant(
    sellerId: string,
    productId: string,
    input: CreateProductVariantInput,
  ) {
    const { sellerObjectId, productObjectId } = await this.getOwnedProduct(
      sellerId,
      productId,
    );

    const discount = this.normalizeDiscount(input.discount ?? null);

    this.validateDiscount(input.price, discount);

    try {
      return await ProductVariantModel.create({
        productId: productObjectId,
        sellerId: sellerObjectId,
        name: input.name,
        attributes: input.attributes,
        sku: this.normalizeSku(input.sku),
        price: input.price,
        stockQuantity: input.stockQuantity,
        reservedQuantity: 0,
        status: 'active',
        discount,
      });
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  /**
   * Lists variants belonging to a product owned by the authenticated seller.
   */
  async getVariants(sellerId: string, productId: string) {
    const { productObjectId } = await this.getOwnedProduct(sellerId, productId);

    return ProductVariantModel.find({ productId: productObjectId })
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec();
  }

  /**
   * Updates seller-managed variant details without changing its ownership.
   */
  async updateVariant(
    sellerId: string,
    productId: string,
    variantId: string,
    input: UpdateProductVariantInput,
  ) {
    const { sellerObjectId, productObjectId } = await this.getOwnedProduct(
      sellerId,
      productId,
    );

    const variantObjectId = this.toObjectId(
      variantId,
      'INVALID_VARIANT_ID',
      'variant',
    );

    const variant = await ProductVariantModel.findOne({
      _id: variantObjectId,
      productId: productObjectId,
      sellerId: sellerObjectId,
    }).exec();

    if (!variant) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_VARIANT_NOT_FOUND',
        message: 'The requested product variant was not found.',
      });
    }

    const nextPrice = input.price ?? variant.price;

    const nextDiscount =
      input.discount === undefined
        ? variant.discount
        : this.normalizeDiscount(input.discount);

    this.validateDiscount(nextPrice, nextDiscount);

    if (
      input.stockQuantity !== undefined &&
      input.stockQuantity < variant.reservedQuantity
    ) {
      throw new AppError({
        statusCode: 409,
        code: 'STOCK_BELOW_RESERVED_QUANTITY',
        message:
          'Stock cannot be lower than the quantity reserved for checkout.',
      });
    }

    if (input.status === 'inactive' && variant.reservedQuantity > 0) {
      throw new AppError({
        statusCode: 409,
        code: 'VARIANT_HAS_ACTIVE_RESERVATIONS',
        message:
          'A variant with active stock reservations cannot be deactivated.',
      });
    }

    try {
      if (input.name !== undefined) variant.name = input.name;
      if (input.attributes !== undefined) {
        variant.attributes = input.attributes;
      }
      if (input.sku !== undefined) {
        variant.sku = this.normalizeSku(input.sku);
      }
      if (input.price !== undefined) variant.price = input.price;
      if (input.stockQuantity !== undefined) {
        variant.stockQuantity = input.stockQuantity;
      }
      if (input.status !== undefined) variant.status = input.status;

      if (input.discount !== undefined) {
        variant.discount = this.normalizeDiscount(input.discount);
      }

      await variant.save();

      return variant;
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  /**
   * Activates or deactivates a variant without deleting its record.
   */
  async updateVariantStatus(
    sellerId: string,
    productId: string,
    variantId: string,
    status: 'active' | 'inactive',
  ) {
    const { sellerObjectId, productObjectId } = await this.getOwnedProduct(
      sellerId,
      productId,
    );

    const variantObjectId = this.toObjectId(
      variantId,
      'INVALID_VARIANT_ID',
      'variant',
    );

    const variant = await ProductVariantModel.findOne({
      _id: variantObjectId,
      productId: productObjectId,
      sellerId: sellerObjectId,
    }).exec();

    if (!variant) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_VARIANT_NOT_FOUND',
        message: 'The requested product variant was not found.',
      });
    }

    if (status === 'inactive' && variant.reservedQuantity > 0) {
      throw new AppError({
        statusCode: 409,
        code: 'VARIANT_HAS_ACTIVE_RESERVATIONS',
        message:
          'A variant with active stock reservations cannot be deactivated.',
      });
    }

    variant.status = status;

    await variant.save();

    return variant;
  }

  /**
   * Confirms that the seller owns the requested product.
   */
  private async getOwnedProduct(sellerId: string, productId: string) {
    const sellerObjectId = this.toObjectId(
      sellerId,
      'INVALID_SELLER_ID',
      'seller',
    );

    const productObjectId = this.toObjectId(
      productId,
      'INVALID_PRODUCT_ID',
      'product',
    );

    const product = await ProductModel.exists({
      _id: productObjectId,
      sellerId: sellerObjectId,
    });

    if (!product) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'The requested product was not found.',
      });
    }

    return { sellerObjectId, productObjectId };
  }

  /** Converts an identifier to ObjectId or returns a consistent client error. */
  private toObjectId(
    value: string,
    code: string,
    label: string,
  ): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new AppError({
        statusCode: 400,
        code,
        message: `The ${label} ID is invalid.`,
      });
    }

    return new Types.ObjectId(value);
  }

  /** Normalizes optional SKUs before persistence. */
  private normalizeSku(sku: string | null | undefined): string | null {
    const normalized = sku?.trim().toUpperCase();

    return normalized || null;
  }

  /**
   * Rejects invalid discounts and verifies fixed prices against regular prices.
   */
  private validateDiscount(
    regularPrice: number,
    discount: VariantDiscount | null,
  ): void {
    if (!discount) return;

    if (
      discount.type === 'percentage' &&
      (discount.value <= 0 || discount.value > 100)
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PERCENTAGE_DISCOUNT',
        message:
          'A percentage discount must be greater than 0% and at most 100%.',
      });
    }

    if (
      discount.type === 'fixed_price' &&
      (discount.value <= 0 || discount.value >= regularPrice)
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_FIXED_PRICE_DISCOUNT',
        message:
          'The discounted price must be positive and below the regular price.',
      });
    }

    if (
      discount.startsAt &&
      discount.endsAt &&
      discount.endsAt.getTime() <= discount.startsAt.getTime()
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_DISCOUNT_DATE_RANGE',
        message: 'The discount end time must be after its start time.',
      });
    }

    /* Reject configurations that cannot produce a lower whole-XAF price. */
    const effectivePrice = variantPricingService.getDiscountedPrice(
      regularPrice,
      discount,
    );

    if (discount.type === 'percentage' && discount.value === 100) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PERCENTAGE_DISCOUNT',
        message: 'A discount must leave a positive selling price.',
      });
    }

    if (effectivePrice === null) {
      const now = new Date();
      const startsInFuture =
        discount.startsAt !== null && discount.startsAt > now;
      const alreadyExpired = discount.endsAt !== null && discount.endsAt <= now;

      if (!startsInFuture && !alreadyExpired) {
        throw new AppError({
          statusCode: 400,
          code: 'DISCOUNT_DOES_NOT_REDUCE_PRICE',
          message:
            'The discount must produce a positive price below the regular price.',
        });
      }
    }
  }

  /** Converts duplicate-key and persistence validation errors to API errors. */
  private handlePersistenceError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new AppError({
        statusCode: 409,
        code: 'DUPLICATE_VARIANT_SKU',
        message:
          'This SKU is already used by another variant belonging to the seller.',
      });
    }

    throw error;
  }

  /** Converts validated discount input dates into Date objects. */

  private normalizeDiscount(
    discount:
      | CreateProductVariantInput['discount']
      | UpdateProductVariantInput['discount']
      | VariantDiscount
      | null
      | undefined,
  ): VariantDiscount | null {
    if (!discount) {
      return null;
    }

    return {
      type: discount.type,
      value: discount.value,
      startsAt:
        discount.startsAt == null
          ? null
          : discount.startsAt instanceof Date
            ? discount.startsAt
            : new Date(discount.startsAt),
      endsAt:
        discount.endsAt == null
          ? null
          : discount.endsAt instanceof Date
            ? discount.endsAt
            : new Date(discount.endsAt),
    };
  }
}

/** Default seller variant management service instance. */
export const productVariantService = new ProductVariantService();
