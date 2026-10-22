import mongoose from 'mongoose';
import type { Types } from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { OrderModel } from '../../../shared/orders/models/order.model.js';
import { PaymentModel } from '../../../shared/payments/models/payment.model.js';
import type { Payment } from '../../../shared/payments/types/payment.types.js';
import type { DirectPaymentDeclarationInput } from '../validations/direct-payment-declaration.schema.js';

const ACTIVE_DIRECT_PAYMENT_STATUSES = [
  'pending',
  'reconciliation_required',
] as const;

interface DirectPaymentResult {
  payment: {
    id: string;
    orderId: string;
    reference: string;
    status: Payment['status'];
    amount: number;
    currency: 'XAF';
    directPaymentDeclaration: {
      declaredBy: string;
      declaredAt: Date;
      channel: NonNullable<Payment['directPaymentDeclaration']>['channel'];
      amount: number;
      receivedAt: Date;
      reference: string | null;
      evidenceReference: string | null;
      note: string | null;
    } | null;
  };
  reused: boolean;
}

/** Records seller declarations for direct payments received against orders. */
export class SellerOrderPaymentService {
  async declareDirectPayment(
    sellerId: string,
    orderId: string,
    idempotencyKey: string,
    input: DirectPaymentDeclarationInput,
  ): Promise<DirectPaymentResult> {
    if (
      !mongoose.isValidObjectId(sellerId) ||
      !mongoose.isValidObjectId(orderId)
    ) {
      throw this.orderNotFoundError();
    }

    const normalizedKey = idempotencyKey.trim();

    if (!normalizedKey || normalizedKey.length > 128) {
      throw new AppError({
        statusCode: 400,
        code: 'PAYMENT_IDEMPOTENCY_KEY_REQUIRED',
        message: 'Provide an Idempotency-Key header of at most 128 characters.',
      });
    }

    if (input.receivedAt.getTime() > Date.now()) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_PAYMENT_RECEIVED_AT',
        message: 'The payment receipt time cannot be in the future.',
      });
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const mongoSession = await mongoose.startSession();

    let result: DirectPaymentResult | null = null;
    let duplicateKeyError: unknown;

    try {
      result = await mongoSession.withTransaction(async () => {
        const existing = await PaymentModel.findOne({
          customerId: await this.getOrderCustomerId(
            orderObjectId,
            mongoSession,
          ),
          idempotencyKey: normalizedKey,
        })
          .session(mongoSession)
          .exec();

        if (existing) {
          this.assertSameDeclaration(
            existing.toObject() as Payment,
            orderObjectId,
            sellerObjectId,
            input,
          );

          return {
            payment: this.toPublicPayment(existing.toObject() as Payment),
            reused: true,
          };
        }

        const order = await OrderModel.findOne({
          _id: orderObjectId,
          sellerId: sellerObjectId,
        })
          .session(mongoSession)
          .exec();

        if (!order) {
          throw this.orderNotFoundError();
        }

        if (
          order.status !== 'pending_payment' ||
          order.paymentStatus !== 'pending'
        ) {
          throw new AppError({
            statusCode: 409,
            code: 'ORDER_NOT_PAYABLE',
            message: 'This seller order is no longer awaiting payment.',
          });
        }

        if (input.amount !== order.total) {
          throw new AppError({
            statusCode: 409,
            code: 'DIRECT_PAYMENT_AMOUNT_MISMATCH',
            message: 'The declared amount must equal the seller-order total.',
          });
        }

        const activePayment = await PaymentModel.findOne({
          method: 'direct',
          'sellerOrderAllocations.sellerOrderId': orderObjectId,
          status: { $in: ACTIVE_DIRECT_PAYMENT_STATUSES },
        })
          .session(mongoSession)
          .exec();

        if (activePayment) {
          throw this.activeDeclarationExistsError();
        }

        const paymentId = new mongoose.Types.ObjectId();
        const now = new Date();

        const [created] = await PaymentModel.create(
          [
            {
              _id: paymentId,
              checkoutId: order.checkoutId,
              customerId: order.customerId,
              method: 'direct',
              provider: null,
              providerTransactionId: null,
              reference: `TXP-${paymentId.toString().toUpperCase()}`,
              idempotencyKey: normalizedKey,
              status: 'pending',
              isSimulated: false,
              amount: input.amount,
              currency: 'XAF',
              sellerOrderAllocations: [
                {
                  sellerOrderId: order._id,
                  sellerId: order.sellerId,
                  storeId: order.storeId,
                  amount: order.total,
                  refundedAmount: 0,
                },
              ],
              directPaymentDeclaration: {
                declaredBy: sellerObjectId,
                declaredAt: now,
                channel: input.channel,
                amount: input.amount,
                receivedAt: input.receivedAt,
                reference: input.reference ?? null,
                evidenceReference: input.evidenceReference ?? null,
                note: input.note ?? null,
              },
              reconciliation: {
                reviewedBy: null,
                reviewedAt: null,
                decision: null,
                note: null,
              },
              simulation: null,
              paymentDeadlineAt: input.receivedAt,
              confirmedAt: null,
              failedAt: null,
              cancelledAt: null,
              expiredAt: null,
              refundedAt: null,
            },
          ],
          { session: mongoSession },
        );

        return {
          payment: this.toPublicPayment(created.toObject() as Payment),
          reused: false,
        };
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        duplicateKeyError = error;
      } else {
        throw error;
      }
    } finally {
      await mongoSession.endSession();
    }

    if (duplicateKeyError) {
      const order = await OrderModel.findOne({
        _id: orderObjectId,
        sellerId: sellerObjectId,
      })
        .select('customerId')
        .lean()
        .exec();

      if (order) {
        const existing = await PaymentModel.findOne({
          customerId: order.customerId,
          idempotencyKey: normalizedKey,
        }).exec();

        if (existing) {
          this.assertSameDeclaration(
            existing.toObject() as Payment,
            orderObjectId,
            sellerObjectId,
            input,
          );

          return {
            payment: this.toPublicPayment(existing.toObject() as Payment),
            reused: true,
          };
        }
      }

      const activePayment = await PaymentModel.findOne({
        method: 'direct',
        'sellerOrderAllocations.sellerOrderId': orderObjectId,
        status: { $in: ACTIVE_DIRECT_PAYMENT_STATUSES },
      }).exec();

      if (activePayment) {
        throw this.activeDeclarationExistsError();
      }

      throw duplicateKeyError;
    }

    if (!result) {
      throw new Error('Direct payment declaration completed without a result.');
    }

    return result;
  }

  private async getOrderCustomerId(
    orderId: Types.ObjectId,
    session: mongoose.ClientSession,
  ): Promise<Types.ObjectId> {
    const order = await OrderModel.findById(orderId)
      .select('customerId')
      .session(session)
      .exec();

    if (!order) {
      throw this.orderNotFoundError();
    }

    return order.customerId;
  }

  private assertSameDeclaration(
    payment: Payment,
    orderId: Types.ObjectId,
    sellerId: Types.ObjectId,
    input: DirectPaymentDeclarationInput,
  ): void {
    const allocation = payment.sellerOrderAllocations[0];
    const declaration = payment.directPaymentDeclaration;

    if (
      payment.method !== 'direct' ||
      !allocation ||
      allocation.sellerOrderId.toString() !== orderId.toString() ||
      allocation.sellerId.toString() !== sellerId.toString() ||
      !declaration ||
      declaration.amount !== input.amount ||
      declaration.channel !== input.channel ||
      declaration.receivedAt.getTime() !== input.receivedAt.getTime() ||
      declaration.reference !== (input.reference ?? null) ||
      declaration.evidenceReference !== (input.evidenceReference ?? null) ||
      declaration.note !== (input.note ?? null)
    ) {
      throw new AppError({
        statusCode: 409,
        code: 'PAYMENT_IDEMPOTENCY_KEY_REUSED',
        message: 'This Idempotency-Key was already used for another request.',
      });
    }
  }

  private toPublicPayment(payment: Payment): DirectPaymentResult['payment'] {
    const declaration = payment.directPaymentDeclaration;

    return {
      id: payment._id.toString(),
      orderId: payment.sellerOrderAllocations[0]!.sellerOrderId.toString(),
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      directPaymentDeclaration: declaration
        ? {
            declaredBy: declaration.declaredBy.toString(),
            declaredAt: declaration.declaredAt,
            channel: declaration.channel,
            amount: declaration.amount,
            receivedAt: declaration.receivedAt,
            reference: declaration.reference,
            evidenceReference: declaration.evidenceReference,
            note: declaration.note,
          }
        : null,
    };
  }

  private orderNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'SELLER_ORDER_NOT_FOUND',
      message: 'Seller order not found.',
    });
  }

  private activeDeclarationExistsError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'DIRECT_PAYMENT_DECLARATION_ALREADY_PENDING',
      message: 'A direct-payment declaration is already awaiting review.',
    });
  }
}

export const sellerOrderPaymentService = new SellerOrderPaymentService();
