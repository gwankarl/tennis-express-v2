import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { CartModel } from '../../../shared/cart/models/cart.model.js';
import type { CartItem } from '../../../shared/cart/types/cart.types.js';
import { CheckoutSessionModel } from '../../../shared/checkout/models/checkout-session.model.js';
import type {
  CheckoutSessionItem,
  CheckoutSellerGroup,
} from '../../../shared/checkout/types/checkout-session.types.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import { ProductVariantModel } from '../../../shared/products/models/product-variant.model.js';
import { variantPricingService } from '../../../shared/products/services/variant-pricing.service.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import type { CreateCheckoutSessionInput } from '../validations/create-checkout-session.schema.js';
import { InventoryReservationModel } from '../../../shared/inventory-reservations/models/inventory-reservation.model.js';

const RESERVATION_TTL_MS = 15 * 60 * 1000;

export class CheckoutSessionService {
  /** Validates the cart, snapshots its prices, and reserves stock atomically. */
  async create(
    userId: string,
    idempotencyKey: string,
    input: CreateCheckoutSessionInput,
  ) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      });
    }

    const key = idempotencyKey.trim();
    if (!key || key.length > 128) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Provide an Idempotency-Key header of at most 128 characters.',
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    let previous = await CheckoutSessionModel.findOne({
      userId: userObjectId,
      idempotencyKey: key,
    })
      .lean()
      .exec();

    /* Release an expired retry's stock before returning its session record. */
    if (
      previous?.status === 'active' &&
      previous.reservationExpiresAt &&
      previous.reservationExpiresAt <= new Date()
    ) {
      await this.expireCheckoutReservations(previous._id, new Date());
      previous = await CheckoutSessionModel.findOne({
        userId: userObjectId,
        idempotencyKey: key,
      })
        .lean()
        .exec();
    }

    if (previous) {
      return { session: previous, reused: true };
    }

    const mongoSession = await mongoose.startSession();
    let created: unknown;

    try {
      await mongoSession.withTransaction(async () => {
        const cart = await CartModel.findOne({ userId: userObjectId })
          .session(mongoSession)
          .lean()
          .exec();

        if (!cart || cart.items.length === 0) {
          throw new AppError({
            statusCode: 400,
            code: 'CART_EMPTY',
            message: 'Add items to your cart before starting checkout.',
          });
        }

        const variantIds = cart.items.map((item: CartItem) => item.variantId);
        const variants = await ProductVariantModel.find({
          _id: { $in: variantIds },
        })
          .session(mongoSession)
          .lean()
          .exec();
        const variantById = new Map(
          variants.map((variant) => [variant._id.toString(), variant]),
        );

        const productIds = variants.map((variant) => variant.productId);
        const products = await ProductModel.find({
          _id: { $in: productIds },
          moderationStatus: 'approved',
          publicationStatus: 'published',
          publishedAt: { $ne: null },
        })
          .session(mongoSession)
          .lean()
          .exec();
        const productById = new Map(
          products.map((product) => [product._id.toString(), product]),
        );

        const storeIds = products.map((product) => product.storeId);
        const stores = await StoreModel.find({
          _id: { $in: storeIds },
          status: 'active',
        })
          .session(mongoSession)
          .lean()
          .exec();
        const storeById = new Map(
          stores.map((store) => [store._id.toString(), store]),
        );

        const sellerIds = products.map((product) => product.sellerId);
        const sellers = await UserModel.find({
          _id: { $in: sellerIds },
          status: 'active',
          deletedAt: null,
          roles: { $in: ['seller', 'both'] },
        })
          .select('_id')
          .session(mongoSession)
          .lean()
          .exec();
        const activeSellers = new Set(
          sellers.map((seller) => seller._id.toString()),
        );

        const selectionsByStore = new Map(
          input.sellerGroups.map((group) => [
            group.storeId.toLowerCase(),
            group,
          ]),
        );

        if (selectionsByStore.size !== input.sellerGroups.length) {
          throw this.invalidFulfilmentError();
        }

        const now = new Date();
        const items: CheckoutSessionItem[] = [];
        const groups = new Map<string, CheckoutSellerGroup>();
        const reservations = new Map<string, number>();

        for (const cartItem of cart.items) {
          const variantId = cartItem.variantId.toString();
          const variant = variantById.get(variantId);
          const product =
            variant && productById.get(variant.productId.toString());
          const store = product && storeById.get(product.storeId.toString());

          if (
            !variant ||
            variant.status !== 'active' ||
            !product ||
            !store ||
            product.sellerId.toString() !== variant.sellerId.toString() ||
            product.storeId.toString() !== store._id.toString() ||
            store.sellerId.toString() !== product.sellerId.toString() ||
            !activeSellers.has(product.sellerId.toString())
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'CART_ITEM_UNAVAILABLE',
              message:
                'One or more cart items are no longer available. Refresh your cart and try again.',
            });
          }

          const availableQuantity =
            variant.stockQuantity - variant.reservedQuantity;

          if (cartItem.quantity > availableQuantity) {
            throw new AppError({
              statusCode: 409,
              code: 'INSUFFICIENT_STOCK',
              message: 'One or more cart items no longer have enough stock.',
            });
          }

          const selection = selectionsByStore.get(
            store._id.toString().toLowerCase(),
          );
          if (!selection) {
            throw this.invalidFulfilmentError();
          }

          const options =
            selection.fulfilmentMethod === 'delivery'
              ? store.deliveryOptions
              : store.collectionOptions;
          const matchingOptions = options.filter(
            (option: { name: string }) =>
              option.name === selection.fulfilmentOptionName,
          );

          /* Names are used because store options do not currently have IDs. */
          if (matchingOptions.length !== 1) {
            throw this.invalidFulfilmentError();
          }

          const option = matchingOptions[0]!;
          const effectivePrice = variantPricingService.getEffectivePrice(
            variant.price,
            variant.discount,
            now,
          );
          const itemDiscount = variant.price - effectivePrice;

          if (!Number.isSafeInteger(option.fee)) {
            throw new AppError({
              statusCode: 409,
              code: 'INVALID_FULFILMENT_FEE',
              message: 'The selected fulfilment option has an invalid XAF fee.',
            });
          }

          items.push({
            productId: product._id,
            variantId: variant._id,
            sellerId: product.sellerId,
            storeId: store._id,
            productName: product.name,
            variantName: variant.name,
            sku: variant.sku,
            quantity: cartItem.quantity,
            regularUnitPrice: variant.price,
            unitPrice: effectivePrice,
            discountAmount: itemDiscount,
            discount:
              itemDiscount > 0 && variant.discount
                ? {
                    type: variant.discount.type,
                    value: variant.discount.value,
                  }
                : null,
          });

          reservations.set(
            variantId,
            (reservations.get(variantId) ?? 0) + cartItem.quantity,
          );

          const groupKey = store._id.toString();
          const group = groups.get(groupKey) ?? {
            sellerId: product.sellerId,
            storeId: store._id,
            storeName: store.name,
            fulfilmentMethod: selection.fulfilmentMethod,
            fulfilmentOptionName: option.name,
            fulfilmentDescription: option.description,
            deliveryFee: option.fee,
            itemSubtotal: 0,
            discountTotal: 0,
          };

          group.itemSubtotal += variant.price * cartItem.quantity;
          group.discountTotal += itemDiscount * cartItem.quantity;
          groups.set(groupKey, group);
        }

        if (selectionsByStore.size !== groups.size) {
          throw this.invalidFulfilmentError();
        }

        const subtotal = items.reduce(
          (sum, item) => sum + item.regularUnitPrice * item.quantity,
          0,
        );
        const discountTotal = items.reduce(
          (sum, item) => sum + item.discountAmount * item.quantity,
          0,
        );
        const deliveryTotal = [...groups.values()].reduce(
          (sum, group) => sum + group.deliveryFee,
          0,
        );
        const total = subtotal - discountTotal + deliveryTotal;

        if (
          ![subtotal, discountTotal, deliveryTotal, total].every(
            Number.isSafeInteger,
          )
        ) {
          throw new AppError({
            statusCode: 400,
            code: 'CHECKOUT_TOTAL_TOO_LARGE',
            message: 'The checkout total exceeds the supported amount.',
          });
        }

        /* Reserve only if the remaining stock still covers the requested quantity. */
        for (const [variantId, quantity] of reservations) {
          const result = await ProductVariantModel.updateOne(
            {
              _id: variantId,
              status: 'active',
              $expr: {
                $gte: [
                  { $subtract: ['$stockQuantity', '$reservedQuantity'] },
                  quantity,
                ],
              },
            },
            { $inc: { reservedQuantity: quantity } },
            { session: mongoSession },
          ).exec();

          if (result.modifiedCount !== 1) {
            throw new AppError({
              statusCode: 409,
              code: 'INSUFFICIENT_STOCK',
              message:
                'Stock changed while checkout was starting. Refresh your cart and try again.',
            });
          }
        }

        const reservationExpiresAt = new Date(
          now.getTime() + RESERVATION_TTL_MS,
        );

        const [document] = await CheckoutSessionModel.create(
          [
            {
              userId: userObjectId,
              status: 'active',
              items,
              sellerGroups: [...groups.values()],
              subtotal,
              discountTotal,
              deliveryTotal,
              processingFee: 0,
              total,
              reservationExpiresAt,
              orderIds: [],
              idempotencyKey: key,
            },
          ],
          { session: mongoSession },
        );

        const reservationRecords = [];

        /* Reserve stock only while enough unreserved quantity remains. */
        for (const [variantId, quantity] of reservations) {
          const result = await ProductVariantModel.updateOne(
            {
              _id: variantId,
              status: 'active',
              $expr: {
                $gte: [
                  { $subtract: ['$stockQuantity', '$reservedQuantity'] },
                  quantity,
                ],
              },
            },
            { $inc: { reservedQuantity: quantity } },
            { session: mongoSession },
          ).exec();

          if (result.modifiedCount !== 1) {
            throw new AppError({
              statusCode: 409,
              code: 'INSUFFICIENT_STOCK',
              message:
                'Stock changed while checkout was starting. Refresh your cart and try again.',
            });
          }

          reservationRecords.push({
            checkoutId: document!._id,
            userId: userObjectId,
            variantId: new mongoose.Types.ObjectId(variantId),
            quantity,
            status: 'active' as const,
            expiresAt: reservationExpiresAt,
            releasedAt: null,
          });
        }

        await InventoryReservationModel.create(reservationRecords, {
          session: mongoSession,
        });

        created = document!.toObject();
      });
    } catch (error) {
      /* A concurrent request may have created this customer's same key. */
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        const existing = await CheckoutSessionModel.findOne({
          userId: userObjectId,
          idempotencyKey: key,
        })
          .lean()
          .exec();

        if (existing) {
          return { session: existing, reused: true };
        }
      }

      throw error;
    } finally {
      await mongoSession.endSession();
    }

    return { session: created, reused: false };
  }

  /** Expires due reservation records and releases their stock atomically. */
  async expireDueReservations(
    now = new Date(),
    batchSize = 100,
  ): Promise<number> {
    const dueReservations = await InventoryReservationModel.find({
      status: 'active',
      expiresAt: { $lte: now },
    })
      .select('checkoutId')
      .sort({ expiresAt: 1 })
      .limit(batchSize)
      .lean()
      .exec();

    const checkoutIds = [
      ...new Set(
        dueReservations.map((reservation) => reservation.checkoutId.toString()),
      ),
    ];

    let expiredCount = 0;

    for (const checkoutId of checkoutIds) {
      if (
        await this.expireCheckoutReservations(
          new mongoose.Types.ObjectId(checkoutId),
          now,
        )
      ) {
        expiredCount += 1;
      }
    }

    return expiredCount;
  }

  /** Expires every reservation for one checkout in a single transaction. */
  private async expireCheckoutReservations(
    checkoutId: mongoose.Types.ObjectId,
    now: Date,
  ): Promise<boolean> {
    const mongoSession = await mongoose.startSession();
    let expired = false;

    try {
      await mongoSession.withTransaction(async () => {
        const checkout = await CheckoutSessionModel.findOne({
          _id: checkoutId,
          status: 'active',
          reservationExpiresAt: { $lte: now },
        })
          .session(mongoSession)
          .exec();

        if (!checkout) return;

        const reservations = await InventoryReservationModel.find({
          checkoutId,
          status: 'active',
        })
          .session(mongoSession)
          .exec();

        /* Ensure every checkout item still has its matching active reservation. */
        const expectedQuantities = new Map<string, number>();
        for (const item of checkout.items) {
          const variantId = item.variantId.toString();
          expectedQuantities.set(
            variantId,
            (expectedQuantities.get(variantId) ?? 0) + item.quantity,
          );
        }

        if (reservations.length !== expectedQuantities.size) {
          throw new Error(
            `Checkout ${checkoutId.toString()} has missing or duplicate reservation records.`,
          );
        }

        for (const reservation of reservations) {
          const variantId = reservation.variantId.toString();
          const expectedQuantity = expectedQuantities.get(variantId);

          if (
            expectedQuantity !== reservation.quantity ||
            reservation.expiresAt > now
          ) {
            throw new Error(
              `Checkout ${checkoutId.toString()} has an inconsistent reservation for variant ${variantId}.`,
            );
          }
        }

        for (const reservation of reservations) {
          const updatedReservation =
            await InventoryReservationModel.findOneAndUpdate(
              {
                _id: reservation._id,
                status: 'active',
                expiresAt: { $lte: now },
              },
              {
                $set: {
                  status: 'expired',
                  releasedAt: now,
                },
              },
              {
                new: true,
                session: mongoSession,
              },
            ).exec();

          if (!updatedReservation) {
            throw new Error(
              `Reservation ${reservation._id.toString()} was no longer active.`,
            );
          }

          const stockUpdate = await ProductVariantModel.updateOne(
            {
              _id: reservation.variantId,
              reservedQuantity: { $gte: reservation.quantity },
            },
            { $inc: { reservedQuantity: -reservation.quantity } },
            { session: mongoSession },
          ).exec();

          if (stockUpdate.modifiedCount !== 1) {
            throw new Error(
              `Could not release stock for variant ${reservation.variantId.toString()}.`,
            );
          }
        }

        checkout.status = 'expired';
        checkout.reservationExpiresAt = null;
        await checkout.save({ session: mongoSession });

        expired = true;
      });
    } finally {
      await mongoSession.endSession();
    }

    return expired;
  }

  private invalidFulfilmentError(): AppError {
    return new AppError({
      statusCode: 400,
      code: 'INVALID_FULFILMENT_SELECTION',
      message:
        'Choose one valid fulfilment option for each store in your cart.',
    });
  }
}

export const checkoutSessionService = new CheckoutSessionService();
