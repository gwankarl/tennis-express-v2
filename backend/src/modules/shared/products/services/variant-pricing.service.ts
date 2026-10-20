import type { VariantDiscount } from '../types/product-variant.types.js';

/** Calculates the effective selling price for a product variant. */
export class VariantPricingService {
  /**
   * Returns the discounted price when a discount is active.
   * Otherwise, returns null to indicate that no discount applies.
   */
  getDiscountedPrice(
    regularPrice: number,
    discount: VariantDiscount | null,
    now: Date = new Date(),
  ): number | null {
    if (!discount) {
      return null;
    }

    if (
      discount.startsAt !== null &&
      now.getTime() < discount.startsAt.getTime()
    ) {
      return null;
    }

    if (
      discount.endsAt !== null &&
      now.getTime() >= discount.endsAt.getTime()
    ) {
      return null;
    }

    if (discount.type === 'percentage') {
      if (discount.value <= 0 || discount.value > 100) {
        return null;
      }

      const discountedPrice = Math.round(
        regularPrice * (1 - discount.value / 100),
      );

      return discountedPrice > 0 && discountedPrice < regularPrice
        ? discountedPrice
        : null;
    }

    if (discount.type === 'fixed_price') {
      return discount.value > 0 && discount.value < regularPrice
        ? discount.value
        : null;
    }

    return null;
  }

  /** Returns the price the customer should currently pay. */
  getEffectivePrice(
    regularPrice: number,
    discount: VariantDiscount | null,
    now: Date = new Date(),
  ): number {
    return this.getDiscountedPrice(regularPrice, discount, now) ?? regularPrice;
  }
}

/** Default shared variant pricing service instance. */
export const variantPricingService = new VariantPricingService();
