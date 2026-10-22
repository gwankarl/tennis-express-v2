import type { ClientSession } from 'mongoose';

import { InventoryReservationModel } from '../../inventory-reservations/models/inventory-reservation.model.js';
import { OrderModel } from '../../orders/models/order.model.js';
import { ProductVariantModel } from '../../products/models/product-variant.model.js';
import type { Payment } from '../types/payment.types.js';

/** Applies order and inventory changes after payment reconciliation. */
export class PaymentInventoryService {
  /**
   * Confirms unpaid seller orders and consumes their committed stock.
   */
  async confirm(payment: Payment, session: ClientSession): Promise<void> {
    const orders = await this.getPaymentOrders(payment, session);

    if (
      orders.some(
        (order) =>
          order.status !== 'pending_payment' ||
          order.paymentStatus !== 'pending',
      )
    ) {
      throw new Error(
        `Payment ${payment._id.toString()} has orders that are no longer payable.`,
      );
    }

    const reservations = await this.getMatchingCommittedReservations(
      payment,
      orders,
      session,
    );

    for (const reservation of reservations) {
      const result = await ProductVariantModel.updateOne(
        {
          _id: reservation.variantId,
          stockQuantity: { $gte: reservation.quantity },
          reservedQuantity: { $gte: reservation.quantity },
        },
        {
          $inc: {
            stockQuantity: -reservation.quantity,
            reservedQuantity: -reservation.quantity,
          },
        },
        { session },
      ).exec();

      if (result.modifiedCount !== 1) {
        throw new Error(
          `Stock could not be consumed for variant ${reservation.variantId.toString()}.`,
        );
      }
    }

    const orderIds = payment.sellerOrderAllocations.map(
      (allocation) => allocation.sellerOrderId,
    );

    const result = await OrderModel.updateMany(
      {
        _id: { $in: orderIds },
        checkoutId: payment.checkoutId,
        customerId: payment.customerId,
        status: 'pending_payment',
        paymentStatus: 'pending',
      },
      {
        $set: {
          status: 'confirmed',
          paymentStatus: 'paid',
        },
      },
      { session },
    ).exec();

    if (result.modifiedCount !== orderIds.length) {
      throw new Error(
        `Not all orders for payment ${payment._id.toString()} could be confirmed.`,
      );
    }
  }

  /**
   * Cancels unpaid orders and releases their committed stock.
   */
  async reject(
    payment: Payment,
    releasedAt: Date,
    session: ClientSession,
  ): Promise<void> {
    const orders = await this.getPaymentOrders(payment, session);
    const reservations = await this.getMatchingCommittedReservations(
      payment,
      orders,
      session,
    );

    for (const reservation of reservations) {
      const reservationUpdate = await InventoryReservationModel.updateOne(
        {
          _id: reservation._id,
          status: 'committed',
        },
        {
          $set: {
            status: 'released',
            releasedAt,
          },
        },
        { session },
      ).exec();

      if (reservationUpdate.modifiedCount !== 1) {
        throw new Error(
          `Reservation ${reservation._id.toString()} could not be released.`,
        );
      }

      const stockUpdate = await ProductVariantModel.updateOne(
        {
          _id: reservation.variantId,
          reservedQuantity: { $gte: reservation.quantity },
        },
        {
          $inc: { reservedQuantity: -reservation.quantity },
        },
        { session },
      ).exec();

      if (stockUpdate.modifiedCount !== 1) {
        throw new Error(
          `Reserved stock could not be released for variant ${reservation.variantId.toString()}.`,
        );
      }
    }

    const orderIds = payment.sellerOrderAllocations.map(
      (allocation) => allocation.sellerOrderId,
    );

    const orderUpdate = await OrderModel.updateMany(
      {
        _id: { $in: orderIds },
        checkoutId: payment.checkoutId,
        customerId: payment.customerId,
        status: 'pending_payment',
        paymentStatus: 'pending',
      },
      {
        $set: {
          status: 'cancelled',
          paymentStatus: 'failed',
        },
      },
      { session },
    ).exec();

    if (orderUpdate.modifiedCount !== orderIds.length) {
      throw new Error(
        `Not all unpaid orders for payment ${payment._id.toString()} could be cancelled.`,
      );
    }
  }

  private async getPaymentOrders(payment: Payment, session: ClientSession) {
    const orderIds = payment.sellerOrderAllocations.map(
      (allocation) => allocation.sellerOrderId,
    );

    const orders = await OrderModel.find({
      _id: { $in: orderIds },
      checkoutId: payment.checkoutId,
      customerId: payment.customerId,
    })
      .session(session)
      .exec();

    if (orders.length !== orderIds.length || orders.length === 0) {
      throw new Error(
        `Payment ${payment._id.toString()} has missing seller orders.`,
      );
    }

    return orders;
  }

  private async getMatchingCommittedReservations(
    payment: Payment,
    orders: Awaited<ReturnType<PaymentInventoryService['getPaymentOrders']>>,
    session: ClientSession,
  ) {
    const expectedQuantities = new Map<string, number>();

    for (const order of orders) {
      for (const item of order.items) {
        const variantId = item.variantId.toString();

        expectedQuantities.set(
          variantId,
          (expectedQuantities.get(variantId) ?? 0) + item.quantity,
        );
      }
    }

    const reservations = await InventoryReservationModel.find({
      checkoutId: payment.checkoutId,
      userId: payment.customerId,
      status: 'committed',
    })
      .session(session)
      .exec();

    if (reservations.length !== expectedQuantities.size) {
      throw new Error(
        `Checkout ${payment.checkoutId.toString()} has inconsistent committed reservations.`,
      );
    }

    for (const reservation of reservations) {
      const expectedQuantity = expectedQuantities.get(
        reservation.variantId.toString(),
      );

      if (expectedQuantity !== reservation.quantity) {
        throw new Error(
          `Reservation ${reservation._id.toString()} does not match its seller-order quantity.`,
        );
      }
    }

    return reservations;
  }
}

export const paymentInventoryService = new PaymentInventoryService();
