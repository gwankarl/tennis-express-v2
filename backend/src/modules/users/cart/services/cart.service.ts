import mongoose from 'mongoose';
import type { CartItem } from '../../../shared/cart/types/cart.types.js';

import { AppError } from '../../../../shared/errors/app-error.js';
import { CartModel } from '../../../shared/cart/models/cart.model.js';
import { ProductVariantModel } from '../../../shared/products/models/product-variant.model.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { variantPricingService } from '../../../shared/products/services/variant-pricing.service.js';
import { AddCartItemInput } from '../validations/cart.schemas.js';
import type { UpdateCartItemQuantityInput } from '../validations/cart-item-quantity.schema.js';

/** Retrieves the authenticated customer's cart and current item details. */
export class CartService {
  async getCart(userId: string) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .lean()
      .exec();

    if (!cart || cart.items.length === 0) {
      return { items: [] };
    }

    const items = await Promise.all(
      cart.items.map(async (cartItem: CartItem) => {
        const variant = await ProductVariantModel.findById(cartItem.variantId)
          .lean()
          .exec();

        if (!variant) {
          return {
            variantId: cartItem.variantId.toString(),
            quantity: cartItem.quantity,
            addedAt: cartItem.addedAt,
            available: false,
            unavailableReason: 'variant_unavailable',
            variant: null,
            product: null,
          };
        }

        const product = await ProductModel.findOne({
          _id: variant.productId,
          sellerId: variant.sellerId,
          moderationStatus: 'approved',
          publicationStatus: 'published',
          publishedAt: { $ne: null },
        })
          .lean()
          .exec();

        if (!product) {
          return {
            variantId: cartItem.variantId.toString(),
            quantity: cartItem.quantity,
            addedAt: cartItem.addedAt,
            available: false,
            unavailableReason: 'product_unavailable',
            variant: null,
            product: null,
          };
        }

        const [store, seller] = await Promise.all([
          StoreModel.findOne({
            _id: product.storeId,
            sellerId: product.sellerId,
            status: 'active',
          })
            .select('name slug')
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
          return {
            variantId: cartItem.variantId.toString(),
            quantity: cartItem.quantity,
            addedAt: cartItem.addedAt,
            available: false,
            unavailableReason: 'seller_unavailable',
            variant: null,
            product: null,
          };
        }

        const availableQuantity = Math.max(
          0,
          variant.stockQuantity - variant.reservedQuantity,
        );

        const effectivePrice = variantPricingService.getEffectivePrice(
          variant.price,
          variant.discount,
        );

        const available = variant.status === 'active' && availableQuantity > 0;

        return {
          variantId: cartItem.variantId.toString(),
          quantity: cartItem.quantity,
          addedAt: cartItem.addedAt,
          available,
          unavailableReason: available ? null : 'variant_unavailable',
          variant: {
            id: variant._id.toString(),
            name: variant.name,
            attributes: variant.attributes,
            sku: variant.sku,
            price: variant.price,
            effectivePrice,
            stockQuantity: variant.stockQuantity,
            reservedQuantity: variant.reservedQuantity,
            availableQuantity,
          },
          product: {
            id: product._id.toString(),
            name: product.name,
            slug: product.slug,
            condition: product.condition,
            images: product.images,
            store,
          },
        };
      }),
    );

    return { items };
  }

  /** Adds a product variant to the customer's cart without reserving stock. */
  async addItem(userId: string, input: AddCartItemInput) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    if (!mongoose.isValidObjectId(input.variantId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_VARIANT_ID',
        message: 'A valid variant identifier is required.',
      });
    }

    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_QUANTITY',
        message: 'Quantity must be a positive whole number.',
      });
    }

    const variantId = new mongoose.Types.ObjectId(input.variantId);

    const variant = await ProductVariantModel.findById(variantId)
      .select('_id productId sellerId')
      .lean()
      .exec();

    if (!variant) {
      throw new AppError({
        statusCode: 404,
        code: 'VARIANT_NOT_FOUND',
        message: 'The requested product variant could not be found.',
      });
    }

    const product = await ProductModel.findOne({
      _id: variant.productId,
      sellerId: variant.sellerId,
    })
      .select('_id')
      .lean()
      .exec();

    if (!product) {
      throw new AppError({
        statusCode: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'The product associated with this variant could not be found.',
      });
    }

    let cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();

    if (!cart) {
      cart = new CartModel({
        userId: new mongoose.Types.ObjectId(userId),
        items: [],
      });
    }

    const existingItem = cart.items.find(
      (cartItem: CartItem) =>
        cartItem.variantId.toString() === variantId.toString(),
    );

    if (existingItem) {
      const updatedQuantity = existingItem.quantity + input.quantity;

      if (!Number.isSafeInteger(updatedQuantity)) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_QUANTITY',
          message: 'The resulting cart quantity is too large.',
        });
      }

      existingItem.quantity = updatedQuantity;
    } else {
      cart.items.push({
        variantId,
        quantity: input.quantity,
        addedAt: new Date(),
      });
    }

    await cart.save();

    return {
      items: cart.items.map((cartItem: CartItem) => ({
        variantId: cartItem.variantId.toString(),
        quantity: cartItem.quantity,
        addedAt: cartItem.addedAt,
      })),
    };
  }

  /** Updates one existing cart item's quantity without reserving inventory. */
  async updateItemQuantity(
    userId: string,
    variantId: string,
    input: UpdateCartItemQuantityInput,
  ) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    if (!mongoose.isValidObjectId(variantId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_VARIANT_ID',
        message: 'A valid variant identifier is required.',
      });
    }

    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_QUANTITY',
        message: 'Quantity must be a positive whole number.',
      });
    }

    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();

    if (!cart) {
      throw new AppError({
        statusCode: 404,
        code: 'CART_ITEM_NOT_FOUND',
        message: 'The requested item was not found in your cart.',
      });
    }

    const normalizedVariantId = new mongoose.Types.ObjectId(
      variantId,
    ).toString();

    const item = cart.items.find(
      (cartItem: CartItem) =>
        cartItem.variantId.toString() === normalizedVariantId,
    );

    if (!item) {
      throw new AppError({
        statusCode: 404,
        code: 'CART_ITEM_NOT_FOUND',
        message: 'The requested item was not found in your cart.',
      });
    }

    item.quantity = input.quantity;

    await cart.save();

    return {
      variantId: item.variantId.toString(),
      quantity: item.quantity,
      addedAt: item.addedAt,
    };
  }

  /** Removes one item from the customer's cart without changing inventory. */
  async removeItem(userId: string, variantId: string) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    if (!mongoose.isValidObjectId(variantId)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_VARIANT_ID',
        message: 'A valid variant identifier is required.',
      });
    }

    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    }).exec();

    if (!cart) {
      throw new AppError({
        statusCode: 404,
        code: 'CART_ITEM_NOT_FOUND',
        message: 'The requested item was not found in your cart.',
      });
    }

    const normalizedVariantId = new mongoose.Types.ObjectId(
      variantId,
    ).toString();

    const itemIndex = cart.items.findIndex(
      (cartItem: CartItem) =>
        cartItem.variantId.toString() === normalizedVariantId,
    );

    if (itemIndex === -1) {
      throw new AppError({
        statusCode: 404,
        code: 'CART_ITEM_NOT_FOUND',
        message: 'The requested item was not found in your cart.',
      });
    }

    const [removedItem] = cart.items.splice(itemIndex, 1);

    await cart.save();

    return {
      variantId: removedItem!.variantId.toString(),
      removed: true,
    };
  }
}

export const cartService = new CartService();
