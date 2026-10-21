import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { CartModel } from '../../../shared/cart/models/cart.model.js';
import type { CartItem } from '../../../shared/cart/types/cart.types.js';
import { CheckoutSessionModel } from '../../../shared/checkout/models/checkout-session.model.js';
import type {
  CheckoutSession,
  CheckoutSessionItem,
  CheckoutSellerGroup,
} from '../../../shared/checkout/types/checkout-session.types.js';
import type { Order } from '../../../shared/orders/types/order.types.js';
import { ProductModel } from '../../../shared/products/models/product.model.js';
import { ProductVariantModel } from '../../../shared/products/models/product-variant.model.js';
import { variantPricingService } from '../../../shared/products/services/variant-pricing.service.js';
import { StoreModel } from '../../../shared/stores/models/store.model.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import type { CreateCheckoutSessionInput } from '../validations/create-checkout-session.schema.js';
import { InventoryReservationModel } from '../../../shared/inventory-reservations/models/inventory-reservation.model.js';
import type { UpdateCheckoutFulfilmentInput } from '../validations/update-checkout-fulfilment.schema.js';
import type { RevalidateCheckoutSessionInput } from '../validations/revalidate-checkout-session.schema.js';

import { OrderModel } from '../../../shared/orders/models/order.model.js';
import type { OrderItemSnapshot } from '../../../shared/orders/types/order.types.js';
import type { ConfirmCheckoutSessionInput } from '../validations/confirm-checkout-session.schema.js';
import type { CancelCheckoutSessionInput } from '../validations/cancel-checkout-session.schema.js';

type ConfirmCheckoutSessionResult = {
  checkoutSession: CheckoutSession;
  orders: Order[];
  reused: boolean;
};

type CancelCheckoutSessionResult = {
  checkoutSession: CheckoutSession;
  reused: boolean;
};

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
              revision: 1,
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

  /** Returns the checkout and its reservation state to its owning customer. */
  async getById(userId: string, checkoutId: string) {
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(checkoutId)
    ) {
      throw this.checkoutSessionNotFoundError();
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const checkoutObjectId = new mongoose.Types.ObjectId(checkoutId);

    let checkout = await CheckoutSessionModel.findOne({
      _id: checkoutObjectId,
      userId: userObjectId,
    }).exec();

    if (!checkout) {
      throw this.checkoutSessionNotFoundError();
    }

    /* Release expired stock before returning the current persisted state. */
    const now = new Date();
    if (
      checkout.status === 'active' &&
      checkout.reservationExpiresAt &&
      checkout.reservationExpiresAt <= now
    ) {
      await this.expireCheckoutReservations(checkoutObjectId, now);

      checkout = await CheckoutSessionModel.findOne({
        _id: checkoutObjectId,
        userId: userObjectId,
      }).exec();

      if (!checkout) {
        throw this.checkoutSessionNotFoundError();
      }
    }

    const reservations = await InventoryReservationModel.find({
      checkoutId: checkoutObjectId,
      userId: userObjectId,
    })
      .select('variantId quantity status expiresAt releasedAt')
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    return {
      checkoutSession: checkout.toObject(),
      revision: checkout.revision ?? 1,
      reservations,
    };
  }

  /** Updates selected fulfilment options and recalculates checkout totals. */
  async updateFulfilment(
    userId: string,
    checkoutId: string,
    input: UpdateCheckoutFulfilmentInput,
  ) {
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(checkoutId)
    ) {
      throw this.checkoutSessionNotFoundError();
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const checkoutObjectId = new mongoose.Types.ObjectId(checkoutId);

    const initialCheckout = await CheckoutSessionModel.findOne({
      _id: checkoutObjectId,
      userId: userObjectId,
    })
      .select('_id status reservationExpiresAt')
      .lean()
      .exec();

    if (!initialCheckout) {
      throw this.checkoutSessionNotFoundError();
    }

    const preflightNow = new Date();

    if (
      initialCheckout.status === 'active' &&
      initialCheckout.reservationExpiresAt &&
      initialCheckout.reservationExpiresAt <= preflightNow
    ) {
      await this.expireCheckoutReservations(checkoutObjectId, preflightNow);
      throw this.checkoutSessionExpiredError();
    }

    const mongoSession = await mongoose.startSession();
    let updatedCheckout: unknown;
    let expiredDuringUpdate = false;

    try {
      await mongoSession.withTransaction(async () => {
        const checkout = await CheckoutSessionModel.findOne({
          _id: checkoutObjectId,
          userId: userObjectId,
        })
          .session(mongoSession)
          .exec();

        if (!checkout) {
          throw this.checkoutSessionNotFoundError();
        }

        if (checkout.status !== 'active') {
          throw this.checkoutSessionNotActiveError();
        }

        const now = new Date();

        if (
          !checkout.reservationExpiresAt ||
          checkout.reservationExpiresAt <= now
        ) {
          expiredDuringUpdate = true;
          return;
        }

        if (checkout.revision !== input.expectedRevision) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_SESSION_REVISION_CONFLICT',
            message:
              'The checkout changed. Refresh it before updating fulfilment.',
            details: { currentRevision: checkout.revision },
          });
        }

        const selectionsByStore = new Map(
          input.sellerGroups.map((selection) => [
            selection.storeId.toLowerCase(),
            selection,
          ]),
        );

        if (selectionsByStore.size !== input.sellerGroups.length) {
          throw this.invalidFulfilmentError();
        }

        const existingGroupsByStore = new Map<string, CheckoutSellerGroup>(
          checkout.sellerGroups.map(
            (group: CheckoutSellerGroup): [string, CheckoutSellerGroup] => [
              group.storeId.toString().toLowerCase(),
              group,
            ],
          ),
        );

        for (const storeId of selectionsByStore.keys()) {
          if (!existingGroupsByStore.has(storeId)) {
            throw this.invalidFulfilmentError();
          }
        }

        const stores = await StoreModel.find({
          _id: {
            $in: input.sellerGroups.map(
              (selection) => new mongoose.Types.ObjectId(selection.storeId),
            ),
          },
          status: 'active',
        })
          .session(mongoSession)
          .lean()
          .exec();

        const storesById = new Map(
          stores.map((store) => [store._id.toString().toLowerCase(), store]),
        );

        const selectedOptions = new Map<
          string,
          {
            fulfilmentMethod: 'delivery' | 'collection';
            fulfilmentOptionName: string;
            fulfilmentDescription: string;
            deliveryFee: number;
          }
        >();

        for (const selection of input.sellerGroups) {
          const storeKey = selection.storeId.toLowerCase();
          const checkoutGroup = existingGroupsByStore.get(storeKey);
          const store = storesById.get(storeKey);

          if (
            !checkoutGroup ||
            !store ||
            store.sellerId.toString() !== checkoutGroup.sellerId.toString()
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'FULFILMENT_OPTION_UNAVAILABLE',
              message:
                'A selected store or fulfilment option is no longer available.',
            });
          }

          const options =
            selection.fulfilmentMethod === 'delivery'
              ? store.deliveryOptions
              : store.collectionOptions;
          const matchingOptions = options.filter(
            (option: { name: string }) =>
              option.name === selection.fulfilmentOptionName,
          );

          if (matchingOptions.length !== 1) {
            throw this.invalidFulfilmentError();
          }

          const option = matchingOptions[0]!;

          if (!Number.isSafeInteger(option.fee)) {
            throw new AppError({
              statusCode: 409,
              code: 'INVALID_FULFILMENT_FEE',
              message: 'The selected fulfilment option has an invalid XAF fee.',
            });
          }

          selectedOptions.set(storeKey, {
            fulfilmentMethod: selection.fulfilmentMethod,
            fulfilmentOptionName: option.name,
            fulfilmentDescription: option.description,
            deliveryFee: option.fee,
          });
        }

        let hasChanges = false;

        const sellerGroups = checkout.sellerGroups.map(
          (group: CheckoutSellerGroup) => {
            const storeKey = group.storeId.toString().toLowerCase();
            const selection = selectedOptions.get(storeKey);

            if (!selection) {
              return {
                sellerId: group.sellerId,
                storeId: group.storeId,
                storeName: group.storeName,
                fulfilmentMethod: group.fulfilmentMethod,
                fulfilmentOptionName: group.fulfilmentOptionName,
                fulfilmentDescription: group.fulfilmentDescription,
                deliveryFee: group.deliveryFee,
                itemSubtotal: group.itemSubtotal,
                discountTotal: group.discountTotal,
              };
            }

            if (
              group.fulfilmentMethod !== selection.fulfilmentMethod ||
              group.fulfilmentOptionName !== selection.fulfilmentOptionName ||
              group.fulfilmentDescription !== selection.fulfilmentDescription ||
              group.deliveryFee !== selection.deliveryFee
            ) {
              hasChanges = true;
            }

            return {
              sellerId: group.sellerId,
              storeId: group.storeId,
              storeName: group.storeName,
              fulfilmentMethod: selection.fulfilmentMethod,
              fulfilmentOptionName: selection.fulfilmentOptionName,
              fulfilmentDescription: selection.fulfilmentDescription,
              deliveryFee: selection.deliveryFee,
              itemSubtotal: group.itemSubtotal,
              discountTotal: group.discountTotal,
            };
          },
        );

        if (!hasChanges) {
          updatedCheckout = checkout.toObject();
          return;
        }

        const deliveryTotal = sellerGroups.reduce(
          (sum: number, group: CheckoutSellerGroup) => sum + group.deliveryFee,
          0,
        );
        const total =
          checkout.subtotal -
          checkout.discountTotal +
          deliveryTotal +
          checkout.processingFee;

        if (
          !Number.isSafeInteger(deliveryTotal) ||
          !Number.isSafeInteger(total)
        ) {
          throw new AppError({
            statusCode: 400,
            code: 'CHECKOUT_TOTAL_TOO_LARGE',
            message: 'The checkout total exceeds the supported amount.',
          });
        }

        const updated = await CheckoutSessionModel.findOneAndUpdate(
          {
            _id: checkoutObjectId,
            userId: userObjectId,
            status: 'active',
            revision: input.expectedRevision,
            reservationExpiresAt: { $gt: now },
          },
          {
            $set: {
              sellerGroups,
              deliveryTotal,
              total,
            },
            $inc: { revision: 1 },
          },
          {
            new: true,
            runValidators: true,
            session: mongoSession,
          },
        ).exec();

        if (!updated) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_SESSION_REVISION_CONFLICT',
            message:
              'The checkout changed or expired. Refresh it before updating fulfilment.',
          });
        }

        updatedCheckout = updated.toObject();
      });
    } finally {
      await mongoSession.endSession();
    }

    if (expiredDuringUpdate) {
      await this.expireCheckoutReservations(checkoutObjectId, new Date());
      throw this.checkoutSessionExpiredError();
    }

    return updatedCheckout;
  }

  /** Rechecks checkout eligibility, current prices, fulfilment, and reservations. */
  async revalidate(
    userId: string,
    checkoutId: string,
    input: RevalidateCheckoutSessionInput,
  ) {
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(checkoutId)
    ) {
      throw this.checkoutSessionNotFoundError();
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const checkoutObjectId = new mongoose.Types.ObjectId(checkoutId);

    const initialCheckout = await CheckoutSessionModel.findOne({
      _id: checkoutObjectId,
      userId: userObjectId,
    })
      .select('_id status reservationExpiresAt revision')
      .lean()
      .exec();

    if (!initialCheckout) {
      throw this.checkoutSessionNotFoundError();
    }

    const preflightNow = new Date();

    if (
      initialCheckout.status === 'active' &&
      initialCheckout.reservationExpiresAt &&
      initialCheckout.reservationExpiresAt <= preflightNow
    ) {
      await this.expireCheckoutReservations(checkoutObjectId, preflightNow);
      throw this.checkoutSessionExpiredError();
    }

    const mongoSession = await mongoose.startSession();
    let result: unknown;
    let expiredDuringRevalidation = false;

    try {
      await mongoSession.withTransaction(async () => {
        const checkout = await CheckoutSessionModel.findOne({
          _id: checkoutObjectId,
          userId: userObjectId,
        })
          .session(mongoSession)
          .exec();

        if (!checkout) {
          throw this.checkoutSessionNotFoundError();
        }

        if (checkout.status !== 'active') {
          throw this.checkoutSessionNotActiveError();
        }

        const now = new Date();

        if (
          !checkout.reservationExpiresAt ||
          checkout.reservationExpiresAt <= now
        ) {
          expiredDuringRevalidation = true;
          return;
        }

        if (checkout.revision !== input.expectedRevision) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_SESSION_REVISION_CONFLICT',
            message: 'The checkout changed. Refresh it before revalidating.',
            details: { currentRevision: checkout.revision },
          });
        }

        const expectedQuantities = new Map<string, number>();

        for (const item of checkout.items) {
          const variantId = item.variantId.toString();
          expectedQuantities.set(
            variantId,
            (expectedQuantities.get(variantId) ?? 0) + item.quantity,
          );
        }

        const reservations = await InventoryReservationModel.find({
          checkoutId: checkoutObjectId,
          userId: userObjectId,
          status: 'active',
        })
          .session(mongoSession)
          .exec();

        const reservationQuantities = new Map<string, number>();
        const issues: string[] = [];

        for (const reservation of reservations) {
          const variantId = reservation.variantId.toString();

          if (reservation.expiresAt <= now) {
            issues.push('reservation_expired');
          }

          reservationQuantities.set(
            variantId,
            (reservationQuantities.get(variantId) ?? 0) + reservation.quantity,
          );
        }

        if (expectedQuantities.size !== reservationQuantities.size) {
          issues.push('reservation_mismatch');
        } else {
          for (const [variantId, quantity] of expectedQuantities) {
            if (reservationQuantities.get(variantId) !== quantity) {
              issues.push('reservation_mismatch');
              break;
            }
          }
        }

        const variantIds = checkout.items.map(
          (item: CheckoutSessionItem) => item.variantId,
        );
        const variants = await ProductVariantModel.find({
          _id: { $in: variantIds },
        })
          .session(mongoSession)
          .lean()
          .exec();
        const variantsById = new Map(
          variants.map((variant) => [variant._id.toString(), variant]),
        );

        const productIds = checkout.items.map(
          (item: CheckoutSessionItem) => item.productId,
        );
        const products = await ProductModel.find({
          _id: { $in: productIds },
          moderationStatus: 'approved',
          publicationStatus: 'published',
          publishedAt: { $ne: null },
        })
          .session(mongoSession)
          .lean()
          .exec();
        const productsById = new Map(
          products.map((product) => [product._id.toString(), product]),
        );

        const storeIds = checkout.sellerGroups.map(
          (group: CheckoutSellerGroup) => group.storeId,
        );
        const stores = await StoreModel.find({
          _id: { $in: storeIds },
          status: 'active',
        })
          .session(mongoSession)
          .lean()
          .exec();
        const storesById = new Map(
          stores.map((store) => [store._id.toString(), store]),
        );

        const sellerIds = checkout.sellerGroups.map(
          (group: CheckoutSellerGroup) => group.sellerId,
        );
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
        const activeSellerIds = new Set(
          sellers.map((seller) => seller._id.toString()),
        );

        const refreshedItems: CheckoutSessionItem[] = [];

        for (const item of checkout.items) {
          const variant = variantsById.get(item.variantId.toString());
          const product = productsById.get(item.productId.toString());
          const store = storesById.get(item.storeId.toString());

          if (
            !variant ||
            variant.status !== 'active' ||
            !product ||
            !store ||
            product.sellerId.toString() !== item.sellerId.toString() ||
            product.storeId.toString() !== item.storeId.toString() ||
            variant.productId.toString() !== item.productId.toString() ||
            variant.sellerId.toString() !== item.sellerId.toString() ||
            store.sellerId.toString() !== item.sellerId.toString() ||
            !activeSellerIds.has(item.sellerId.toString())
          ) {
            issues.push('item_unavailable');
            continue;
          }

          const unitPrice = variantPricingService.getEffectivePrice(
            variant.price,
            variant.discount,
            now,
          );
          const discountAmount = variant.price - unitPrice;

          refreshedItems.push({
            ...item,
            productName: product.name,
            variantName: variant.name,
            sku: variant.sku,
            regularUnitPrice: variant.price,
            unitPrice,
            discountAmount,
            discount:
              discountAmount > 0 && variant.discount
                ? {
                    type: variant.discount.type,
                    value: variant.discount.value,
                  }
                : null,
          });
        }

        const refreshedGroups: CheckoutSellerGroup[] = [];
        const itemTotalsByStore = new Map<
          string,
          { subtotal: number; discountTotal: number }
        >();

        for (const item of refreshedItems) {
          const storeId = item.storeId.toString();
          const totals = itemTotalsByStore.get(storeId) ?? {
            subtotal: 0,
            discountTotal: 0,
          };

          totals.subtotal += item.regularUnitPrice * item.quantity;
          totals.discountTotal += item.discountAmount * item.quantity;
          itemTotalsByStore.set(storeId, totals);
        }

        for (const group of checkout.sellerGroups) {
          const storeId = group.storeId.toString();
          const store = storesById.get(storeId);
          const totals = itemTotalsByStore.get(storeId);

          if (
            !store ||
            store.sellerId.toString() !== group.sellerId.toString() ||
            !activeSellerIds.has(group.sellerId.toString()) ||
            !totals
          ) {
            issues.push('fulfilment_unavailable');
            continue;
          }

          const options =
            group.fulfilmentMethod === 'delivery'
              ? store.deliveryOptions
              : store.collectionOptions;
          const matchingOptions = options.filter(
            (option: { name: string }) =>
              option.name === group.fulfilmentOptionName,
          );

          if (matchingOptions.length !== 1) {
            issues.push('fulfilment_unavailable');
            continue;
          }

          const option = matchingOptions[0]!;

          if (!Number.isSafeInteger(option.fee)) {
            issues.push('invalid_fulfilment_fee');
            continue;
          }

          refreshedGroups.push({
            ...group,
            storeName: store.name,
            fulfilmentDescription: option.description,
            deliveryFee: option.fee,
            itemSubtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
          });
        }

        if (issues.length > 0) {
          /* Release every active reservation before invalidating the session. */
          for (const reservation of reservations) {
            const released = await InventoryReservationModel.findOneAndUpdate(
              {
                _id: reservation._id,
                status: 'active',
              },
              {
                $set: {
                  status: 'released',
                  releasedAt: now,
                },
              },
              {
                new: true,
                session: mongoSession,
              },
            ).exec();

            if (!released) {
              throw new Error(
                `Reservation ${reservation._id.toString()} changed during revalidation.`,
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

          checkout.status = 'invalidated';
          checkout.reservationExpiresAt = null;
          checkout.revision = (checkout.revision ?? 1) + 1;
          await checkout.save({ session: mongoSession });

          result = {
            valid: false,
            status: checkout.status,
            revision: checkout.revision,
            issues: [...new Set(issues)],
          };
          return;
        }

        const subtotal = refreshedItems.reduce(
          (sum, item) => sum + item.regularUnitPrice * item.quantity,
          0,
        );
        const discountTotal = refreshedItems.reduce(
          (sum, item) => sum + item.discountAmount * item.quantity,
          0,
        );
        const deliveryTotal = refreshedGroups.reduce(
          (sum, group) => sum + group.deliveryFee,
          0,
        );
        const total =
          subtotal - discountTotal + deliveryTotal + checkout.processingFee;

        if (
          ![
            subtotal,
            discountTotal,
            deliveryTotal,
            checkout.processingFee,
            total,
          ].every(Number.isSafeInteger)
        ) {
          throw new AppError({
            statusCode: 400,
            code: 'CHECKOUT_TOTAL_TOO_LARGE',
            message: 'The checkout total exceeds the supported amount.',
          });
        }

        const priceChanges = refreshedItems.flatMap((item, index) => {
          const previous = checkout.items[index];

          if (
            previous &&
            (previous.unitPrice !== item.unitPrice ||
              previous.regularUnitPrice !== item.regularUnitPrice)
          ) {
            return [
              {
                variantId: item.variantId.toString(),
                previousUnitPrice: previous.unitPrice,
                currentUnitPrice: item.unitPrice,
              },
            ];
          }

          return [];
        });

        const fulfilmentFeeChanges = refreshedGroups.flatMap((group, index) => {
          const previous = checkout.sellerGroups[index];

          if (previous && previous.deliveryFee !== group.deliveryFee) {
            return [
              {
                storeId: group.storeId.toString(),
                previousFee: previous.deliveryFee,
                currentFee: group.deliveryFee,
              },
            ];
          }

          return [];
        });

        const snapshotChanged =
          priceChanges.length > 0 ||
          fulfilmentFeeChanges.length > 0 ||
          refreshedItems.some((item, index) => {
            const previous = checkout.items[index];
            return (
              !previous ||
              previous.productName !== item.productName ||
              previous.variantName !== item.variantName ||
              previous.sku !== item.sku ||
              previous.discountAmount !== item.discountAmount
            );
          }) ||
          refreshedGroups.some((group, index) => {
            const previous = checkout.sellerGroups[index];
            return (
              !previous ||
              previous.storeName !== group.storeName ||
              previous.fulfilmentDescription !== group.fulfilmentDescription ||
              previous.itemSubtotal !== group.itemSubtotal ||
              previous.discountTotal !== group.discountTotal
            );
          });

        if (snapshotChanged) {
          checkout.items = refreshedItems;
          checkout.sellerGroups = refreshedGroups;
          checkout.subtotal = subtotal;
          checkout.discountTotal = discountTotal;
          checkout.deliveryTotal = deliveryTotal;
          checkout.total = total;
          checkout.revision = (checkout.revision ?? 1) + 1;
          await checkout.save({ session: mongoSession });
        }

        result = {
          valid: true,
          changed: snapshotChanged,
          requiresConfirmation:
            priceChanges.length > 0 || fulfilmentFeeChanges.length > 0,
          revision: checkout.revision ?? 1,
          checkoutSession: checkout.toObject(),
          changes: {
            priceChanges,
            fulfilmentFeeChanges,
          },
        };
      });
    } finally {
      await mongoSession.endSession();
    }

    if (expiredDuringRevalidation) {
      await this.expireCheckoutReservations(checkoutObjectId, new Date());
      throw this.checkoutSessionExpiredError();
    }

    return result;
  }

  /** Confirms one checkout revision and creates one order per seller/store. */
  async confirm(
    userId: string,
    checkoutId: string,
    input: ConfirmCheckoutSessionInput,
  ): Promise<ConfirmCheckoutSessionResult> {
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(checkoutId)
    ) {
      throw this.checkoutSessionNotFoundError();
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const checkoutObjectId = new mongoose.Types.ObjectId(checkoutId);
    const mongoSession = await mongoose.startSession();
    let result: {
      checkoutSession: CheckoutSession;
      orders: Order[];
      reused: boolean;
    } | null = null;

    try {
      await mongoSession.withTransaction(async () => {
        const checkout = await CheckoutSessionModel.findOne({
          _id: checkoutObjectId,
          userId: userObjectId,
        })
          .session(mongoSession)
          .exec();

        if (!checkout) {
          throw this.checkoutSessionNotFoundError();
        }

        /* Return existing orders for a safe retry after a successful confirm. */
        if (checkout.status === 'completed' && checkout.orderIds.length > 0) {
          const existingOrders = await OrderModel.find({
            _id: { $in: checkout.orderIds },
            checkoutId: checkoutObjectId,
          })
            .session(mongoSession)
            .exec();

          result = {
            checkoutSession: checkout.toObject() as CheckoutSession,
            orders: existingOrders.map((order) => order.toObject() as Order),
            reused: true,
          };
          return;
        }

        if (checkout.status !== 'active') {
          throw this.checkoutSessionNotActiveError();
        }

        const now = new Date();

        if (
          !checkout.reservationExpiresAt ||
          checkout.reservationExpiresAt <= now
        ) {
          throw this.checkoutSessionExpiredError();
        }

        if (checkout.revision !== input.expectedRevision) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_SESSION_REVISION_CONFLICT',
            message:
              'The checkout changed. Refresh and confirm the current revision.',
            details: { currentRevision: checkout.revision },
          });
        }

        const reservations = await InventoryReservationModel.find({
          checkoutId: checkoutObjectId,
          userId: userObjectId,
          status: 'active',
          expiresAt: { $gt: now },
        })
          .session(mongoSession)
          .exec();

        const expectedQuantities = new Map<string, number>();

        for (const item of checkout.items) {
          const variantId = item.variantId.toString();
          expectedQuantities.set(
            variantId,
            (expectedQuantities.get(variantId) ?? 0) + item.quantity,
          );
        }

        const reservedQuantities = new Map<string, number>();

        for (const reservation of reservations) {
          const variantId = reservation.variantId.toString();
          reservedQuantities.set(
            variantId,
            (reservedQuantities.get(variantId) ?? 0) + reservation.quantity,
          );
        }

        if (
          expectedQuantities.size !== reservedQuantities.size ||
          [...expectedQuantities].some(
            ([variantId, quantity]) =>
              reservedQuantities.get(variantId) !== quantity,
          )
        ) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_RESERVATION_INVALID',
            message:
              'The stock reservation is no longer valid. Revalidate checkout.',
          });
        }

        const variantIds = checkout.items.map(
          (item: CheckoutSessionItem) => item.variantId,
        );
        const productIds = checkout.items.map(
          (item: CheckoutSessionItem) => item.productId,
        );
        const storeIds = checkout.sellerGroups.map(
          (group: CheckoutSellerGroup) => group.storeId,
        );
        const sellerIds = checkout.sellerGroups.map(
          (group: CheckoutSellerGroup) => group.sellerId,
        );

        const [variants, products, stores, sellers] = await Promise.all([
          ProductVariantModel.find({ _id: { $in: variantIds } })
            .session(mongoSession)
            .lean()
            .exec(),
          ProductModel.find({
            _id: { $in: productIds },
            moderationStatus: 'approved',
            publicationStatus: 'published',
            publishedAt: { $ne: null },
          })
            .session(mongoSession)
            .lean()
            .exec(),
          StoreModel.find({ _id: { $in: storeIds }, status: 'active' })
            .session(mongoSession)
            .lean()
            .exec(),
          UserModel.find({
            _id: { $in: sellerIds },
            status: 'active',
            deletedAt: null,
            roles: { $in: ['seller', 'both'] },
          })
            .select('_id')
            .session(mongoSession)
            .lean()
            .exec(),
        ]);

        const variantsById = new Map(
          variants.map((variant) => [variant._id.toString(), variant]),
        );
        const productsById = new Map(
          products.map((product) => [product._id.toString(), product]),
        );
        const storesById = new Map(
          stores.map((store) => [store._id.toString(), store]),
        );
        const activeSellerIds = new Set(
          sellers.map((seller) => seller._id.toString()),
        );

        for (const item of checkout.items) {
          const variant = variantsById.get(item.variantId.toString());
          const product = productsById.get(item.productId.toString());

          if (
            !variant ||
            variant.status !== 'active' ||
            !product ||
            product.sellerId.toString() !== item.sellerId.toString() ||
            product.storeId.toString() !== item.storeId.toString() ||
            variant.productId.toString() !== item.productId.toString() ||
            variant.sellerId.toString() !== item.sellerId.toString() ||
            !activeSellerIds.has(item.sellerId.toString())
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'CHECKOUT_ITEM_UNAVAILABLE',
              message:
                'A checkout item is no longer available. Revalidate checkout.',
            });
          }

          const currentUnitPrice = variantPricingService.getEffectivePrice(
            variant.price,
            variant.discount,
            now,
          );

          if (
            variant.price !== item.regularUnitPrice ||
            currentUnitPrice !== item.unitPrice
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'CHECKOUT_PRICE_CHANGED',
              message:
                'A checkout price changed. Revalidate and confirm the new revision.',
            });
          }
        }

        for (const group of checkout.sellerGroups) {
          const store = storesById.get(group.storeId.toString());

          if (
            !store ||
            store.sellerId.toString() !== group.sellerId.toString() ||
            !activeSellerIds.has(group.sellerId.toString())
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'CHECKOUT_FULFILMENT_UNAVAILABLE',
              message:
                'A selected store is no longer available. Revalidate checkout.',
            });
          }

          const options =
            group.fulfilmentMethod === 'delivery'
              ? store.deliveryOptions
              : store.collectionOptions;
          const matchingOptions = options.filter(
            (option: { name: string }) =>
              option.name === group.fulfilmentOptionName,
          );

          if (
            matchingOptions.length !== 1 ||
            matchingOptions[0]!.fee !== group.deliveryFee ||
            matchingOptions[0]!.description !== group.fulfilmentDescription
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'CHECKOUT_FULFILMENT_CHANGED',
              message: 'A fulfilment option changed. Revalidate checkout.',
            });
          }
        }

        const netSubtotal = checkout.subtotal - checkout.discountTotal;
        let allocatedProcessingFee = 0;

        const ordersToCreate = checkout.sellerGroups.map(
          (group: CheckoutSellerGroup, index: number) => {
            const items: OrderItemSnapshot[] = checkout.items
              .filter(
                (item: CheckoutSessionItem) =>
                  item.storeId.toString() === group.storeId.toString() &&
                  item.sellerId.toString() === group.sellerId.toString(),
              )
              .map((item: CheckoutSessionItem) => ({
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                variantName: item.variantName,
                sku: item.sku,
                quantity: item.quantity,
                regularUnitPrice: item.regularUnitPrice,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                discount: item.discount,
              }));

            if (items.length === 0) {
              throw new AppError({
                statusCode: 409,
                code: 'CHECKOUT_SELLER_GROUP_EMPTY',
                message: 'A seller order has no checkout items.',
              });
            }

            const groupNetSubtotal = group.itemSubtotal - group.discountTotal;
            const isLastGroup = index === checkout.sellerGroups.length - 1;
            const processingFeeAllocation = isLastGroup
              ? checkout.processingFee - allocatedProcessingFee
              : Math.floor(
                  (checkout.processingFee * groupNetSubtotal) /
                    Math.max(netSubtotal, 1),
                );

            allocatedProcessingFee += processingFeeAllocation;

            return {
              checkoutId: checkoutObjectId,
              customerId: userObjectId,
              sellerId: group.sellerId,
              storeId: group.storeId,
              items,
              status: 'pending_payment' as const,
              paymentStatus: 'pending' as const,
              fulfilment: {
                method: group.fulfilmentMethod,
                optionName: group.fulfilmentOptionName,
                description: group.fulfilmentDescription,
                storeName: group.storeName,
                storeLocation: {
                  region: storesById.get(group.storeId.toString())!.location
                    .region,
                  city: storesById.get(group.storeId.toString())!.location.city,
                  address: storesById.get(group.storeId.toString())!.location
                    .address,
                },
                deliveryAddress: null,
              },
              subtotal: group.itemSubtotal,
              deliveryCharge: group.deliveryFee,
              processingFeeAllocation,
              total:
                group.itemSubtotal -
                group.discountTotal +
                group.deliveryFee +
                processingFeeAllocation,
              cancellationRequest: null,
              fulfilmentDetails: {
                trackingNumber: null,
                carrier: null,
                dispatchedAt: null,
                deliveredAt: null,
                collectedAt: null,
              },
              receiptConfirmedAt: null,
            };
          },
        );

        const createdOrders = await OrderModel.create(ordersToCreate, {
          session: mongoSession,
        });

        const committedReservations =
          await InventoryReservationModel.updateMany(
            {
              _id: { $in: reservations.map((reservation) => reservation._id) },
              status: 'active',
              expiresAt: { $gt: now },
            },
            {
              $set: { status: 'committed' },
            },
            { session: mongoSession },
          ).exec();

        if (committedReservations.modifiedCount !== reservations.length) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_RESERVATION_CHANGED',
            message:
              'The stock reservation changed. Refresh checkout and try again.',
          });
        }

        checkout.status = 'completed';
        checkout.orderIds = createdOrders.map((order) => order._id);
        checkout.reservationExpiresAt = null;
        checkout.revision = (checkout.revision ?? 1) + 1;
        await checkout.save({ session: mongoSession });

        result = {
          checkoutSession: checkout.toObject() as CheckoutSession,
          orders: createdOrders.map((order) => order.toObject() as Order),
          reused: false,
        };
      });
    } finally {
      await mongoSession.endSession();
    }

    if (!result) {
      throw new Error('Checkout confirmation completed without a result.');
    }

    return result as ConfirmCheckoutSessionResult;
  }

  /** Cancels an active checkout and releases its reserved inventory atomically. */
  async cancel(
    userId: string,
    checkoutId: string,
    input: CancelCheckoutSessionInput,
  ): Promise<CancelCheckoutSessionResult> {
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(checkoutId)
    ) {
      throw this.checkoutSessionNotFoundError();
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const checkoutObjectId = new mongoose.Types.ObjectId(checkoutId);
    const mongoSession = await mongoose.startSession();
    let result: CancelCheckoutSessionResult | null = null;
    let expiredDuringCancellation = false;

    try {
      await mongoSession.withTransaction(async () => {
        const checkout = await CheckoutSessionModel.findOne({
          _id: checkoutObjectId,
          userId: userObjectId,
        })
          .session(mongoSession)
          .exec();

        if (!checkout) {
          throw this.checkoutSessionNotFoundError();
        }

        /* Make a retry safe after the original cancellation succeeded. */
        if (checkout.status === 'cancelled') {
          result = {
            checkoutSession: checkout.toObject() as CheckoutSession,
            reused: true,
          };
          return;
        }

        if (checkout.status !== 'active') {
          throw this.checkoutSessionNotActiveError();
        }

        const now = new Date();

        if (!checkout.reservationExpiresAt) {
          throw this.checkoutSessionExpiredError();
        }

        if (checkout.reservationExpiresAt <= now) {
          expiredDuringCancellation = true;
          return;
        }

        if (checkout.revision !== input.expectedRevision) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_SESSION_REVISION_CONFLICT',
            message: 'The checkout changed. Refresh it before cancelling.',
            details: { currentRevision: checkout.revision },
          });
        }

        const reservations = await InventoryReservationModel.find({
          checkoutId: checkoutObjectId,
          userId: userObjectId,
          status: 'active',
        })
          .session(mongoSession)
          .exec();

        const expectedQuantities = new Map<string, number>();

        for (const item of checkout.items) {
          const variantId = item.variantId.toString();
          expectedQuantities.set(
            variantId,
            (expectedQuantities.get(variantId) ?? 0) + item.quantity,
          );
        }

        const reservedQuantities = new Map<string, number>();

        for (const reservation of reservations) {
          const variantId = reservation.variantId.toString();

          if (reservation.expiresAt <= now) {
            throw this.checkoutSessionExpiredError();
          }

          reservedQuantities.set(
            variantId,
            (reservedQuantities.get(variantId) ?? 0) + reservation.quantity,
          );
        }

        if (
          expectedQuantities.size !== reservedQuantities.size ||
          [...expectedQuantities].some(
            ([variantId, quantity]) =>
              reservedQuantities.get(variantId) !== quantity,
          )
        ) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_RESERVATION_INVALID',
            message:
              'The checkout reservations no longer match the checkout items.',
          });
        }

        for (const reservation of reservations) {
          const releasedReservation =
            await InventoryReservationModel.findOneAndUpdate(
              {
                _id: reservation._id,
                status: 'active',
                expiresAt: { $gt: now },
              },
              {
                $set: {
                  status: 'released',
                  releasedAt: now,
                },
              },
              {
                new: true,
                session: mongoSession,
              },
            ).exec();

          if (!releasedReservation) {
            throw new AppError({
              statusCode: 409,
              code: 'CHECKOUT_RESERVATION_CHANGED',
              message:
                'A checkout reservation changed while cancellation was processing.',
            });
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
            throw new AppError({
              statusCode: 409,
              code: 'CHECKOUT_STOCK_RESERVATION_INVALID',
              message:
                'The reserved stock could not be released. Contact support if this problem continues.',
            });
          }
        }

        checkout.status = 'cancelled';
        checkout.reservationExpiresAt = null;
        checkout.revision = (checkout.revision ?? 1) + 1;
        await checkout.save({ session: mongoSession });

        result = {
          checkoutSession: checkout.toObject() as CheckoutSession,
          reused: false,
        };
      });
    } finally {
      await mongoSession.endSession();
    }

    if (expiredDuringCancellation) {
      await this.expireCheckoutReservations(checkoutObjectId, new Date());
      throw this.checkoutSessionExpiredError();
    }

    if (!result) {
      throw new Error('Checkout cancellation completed without a result.');
    }

    return result as CancelCheckoutSessionResult;
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
        checkout.revision = (checkout.revision ?? 1) + 1;
        await checkout.save({ session: mongoSession });

        expired = true;
      });
    } finally {
      await mongoSession.endSession();
    }

    return expired;
  }

  private checkoutSessionExpiredError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'CHECKOUT_SESSION_EXPIRED',
      message: 'The checkout reservation has expired.',
    });
  }

  private checkoutSessionNotActiveError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'CHECKOUT_SESSION_NOT_ACTIVE',
      message: 'The checkout session can no longer be updated.',
    });
  }

  private invalidFulfilmentError(): AppError {
    return new AppError({
      statusCode: 400,
      code: 'INVALID_FULFILMENT_SELECTION',
      message:
        'Choose one valid fulfilment option for each store in your cart.',
    });
  }

  private checkoutSessionNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'CHECKOUT_SESSION_NOT_FOUND',
      message: 'The requested checkout session could not be found.',
    });
  }
}

export const checkoutSessionService = new CheckoutSessionService();
