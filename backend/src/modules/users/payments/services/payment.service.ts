import mongoose from 'mongoose';
import type { Types } from 'mongoose';

import { env } from '../../../../config/env.js';
import { AppError } from '../../../../shared/errors/app-error.js';
import { CheckoutSessionModel } from '../../../shared/checkout/models/checkout-session.model.js';
import { OrderModel } from '../../../shared/orders/models/order.model.js';
import { PaymentModel } from '../../../shared/payments/models/payment.model.js';
import { createPaymentProvider } from '../../../shared/payments/providers/payment-provider.factory.js';
import type { Payment } from '../../../shared/payments/types/payment.types.js';
import type { CreateIntegratedPaymentInput } from '../validations/create-integrated-payment.schema.js';

const PAYMENT_DEADLINE_MS = 15 * 60 * 1000;
const ACTIVE_INTEGRATED_PAYMENT_STATUSES = [
  'pending',
  'simulated_success',
  'reconciliation_required',
] as const;

interface PublicPayment {
  id: string;
  checkoutId: string;
  reference: string;
  method: 'integrated';
  provider: Payment['provider'];
  providerTransactionId: string | null;
  status: Payment['status'];
  amount: number;
  currency: 'XAF';
  sellerOrderAllocations: Array<{
    sellerOrderId: string;
    sellerId: string;
    storeId: string;
    amount: number;
  }>;
  simulation: Payment['simulation'];
  paymentDeadlineAt: Date;
  createdAt: Date;
}

interface CreateIntegratedPaymentResult {
  payment: PublicPayment;
  reused: boolean;
}

/** Creates and retrieves integrated payment attempts for customers. */
export class PaymentService {
  /**
   * Starts one integrated payment attempt for all seller orders in a checkout.
   */
  async createIntegratedPayment(
    customerId: string,
    checkoutId: string,
    idempotencyKey: string,
    input: CreateIntegratedPaymentInput,
  ): Promise<CreateIntegratedPaymentResult> {
    if (
      !mongoose.isValidObjectId(customerId) ||
      !mongoose.isValidObjectId(checkoutId)
    ) {
      throw this.checkoutNotFoundError();
    }

    const normalizedKey = idempotencyKey.trim();

    if (!normalizedKey || normalizedKey.length > 128) {
      throw new AppError({
        statusCode: 400,
        code: 'PAYMENT_IDEMPOTENCY_KEY_REQUIRED',
        message: 'Provide an Idempotency-Key header of at most 128 characters.',
      });
    }

    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    const checkoutObjectId = new mongoose.Types.ObjectId(checkoutId);
    const mongoSession = await mongoose.startSession();

    let result: CreateIntegratedPaymentResult | null = null;
    let duplicateKeyError: unknown;

    try {
      result = await mongoSession.withTransaction(async () => {
        const existingByKey = await PaymentModel.findOne({
          customerId: customerObjectId,
          idempotencyKey: normalizedKey,
        })
          .session(mongoSession)
          .exec();

        if (existingByKey) {
          this.assertSameRequest(
            existingByKey.toObject() as Payment,
            checkoutObjectId,
            input.provider,
          );

          return {
            payment: this.toPublicPayment(existingByKey.toObject() as Payment),
            reused: true,
          };
        }

        const checkout = await CheckoutSessionModel.findOne({
          _id: checkoutObjectId,
          userId: customerObjectId,
        })
          .session(mongoSession)
          .exec();

        if (!checkout) {
          throw this.checkoutNotFoundError();
        }

        if (checkout.status !== 'completed' || checkout.orderIds.length === 0) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_NOT_READY_FOR_PAYMENT',
            message: 'Confirm the checkout before starting payment.',
          });
        }

        const orders = await OrderModel.find({
          _id: { $in: checkout.orderIds },
          checkoutId: checkoutObjectId,
          customerId: customerObjectId,
        })
          .session(mongoSession)
          .exec();

        if (orders.length !== checkout.orderIds.length || orders.length === 0) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_ORDERS_INVALID',
            message: 'The checkout orders could not be verified.',
          });
        }

        if (
          orders.some(
            (order) =>
              order.status !== 'pending_payment' ||
              order.paymentStatus !== 'pending',
          )
        ) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_ORDERS_NOT_PAYABLE',
            message: 'One or more checkout orders are no longer payable.',
          });
        }

        const amount = orders.reduce((sum, order) => sum + order.total, 0);

        if (
          !Number.isSafeInteger(amount) ||
          amount < 1 ||
          amount !== checkout.total
        ) {
          throw new AppError({
            statusCode: 409,
            code: 'CHECKOUT_TOTAL_MISMATCH',
            message: 'The checkout total does not match its seller orders.',
          });
        }

        const activePayment = await PaymentModel.findOne({
          checkoutId: checkoutObjectId,
          method: 'integrated',
          status: { $in: ACTIVE_INTEGRATED_PAYMENT_STATUSES },
        })
          .session(mongoSession)
          .exec();

        if (activePayment) {
          throw this.activePaymentExistsError();
        }

        if (!env.paymentSimulationEnabled) {
          throw new AppError({
            statusCode: 503,
            code: 'PAYMENT_SIMULATION_DISABLED',
            message: 'Integrated payment simulation is currently unavailable.',
          });
        }

        const paymentId = new mongoose.Types.ObjectId();
        const now = new Date();

        const [createdPayment] = await PaymentModel.create(
          [
            {
              _id: paymentId,
              checkoutId: checkoutObjectId,
              customerId: customerObjectId,
              method: 'integrated',
              provider: input.provider,
              providerTransactionId: null,
              reference: `TXP-${paymentId.toString().toUpperCase()}`,
              idempotencyKey: normalizedKey,
              status: 'pending',
              isSimulated: true,
              amount,
              currency: 'XAF',
              sellerOrderAllocations: orders.map((order) => ({
                sellerOrderId: order._id,
                sellerId: order.sellerId,
                storeId: order.storeId,
                amount: order.total,
                refundedAmount: 0,
              })),
              directPaymentDeclaration: null,
              reconciliation: {
                reviewedBy: null,
                reviewedAt: null,
                decision: null,
                note: null,
              },
              simulation: null,
              paymentDeadlineAt: new Date(now.getTime() + PAYMENT_DEADLINE_MS),
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
          payment: this.toPublicPayment(createdPayment.toObject() as Payment),
          reused: false,
        };
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        duplicateKeyError = error;
      } else {
        throw error;
      }
    } finally {
      await mongoSession.endSession();
    }

    /*
     * Recover from concurrent requests that raced on an idempotency key or
     * the active-payment index.
     */
    if (duplicateKeyError) {
      const existingByKey = await PaymentModel.findOne({
        customerId: customerObjectId,
        idempotencyKey: normalizedKey,
      }).exec();

      if (existingByKey) {
        this.assertSameRequest(
          existingByKey.toObject() as Payment,
          checkoutObjectId,
          input.provider,
        );

        return {
          payment: this.toPublicPayment(existingByKey.toObject() as Payment),
          reused: true,
        };
      }

      const activePayment = await PaymentModel.findOne({
        checkoutId: checkoutObjectId,
        method: 'integrated',
        status: { $in: ACTIVE_INTEGRATED_PAYMENT_STATUSES },
      }).exec();

      if (activePayment) {
        throw this.activePaymentExistsError();
      }

      throw duplicateKeyError;
    }

    if (!result) {
      throw new Error('Payment creation completed without a result.');
    }

    /* An idempotent retry returns the stored attempt without starting it again. */
    if (result.reused) {
      return result;
    }

    const payment = await PaymentModel.findOne({
      reference: result.payment.reference,
      customerId: customerObjectId,
    }).exec();

    if (!payment) {
      throw new Error('The new payment attempt could not be loaded.');
    }

    try {
      const provider = createPaymentProvider(input.provider);
      const startResult = await provider.start({
        reference: payment.reference,
        amount: payment.amount,
        currency: 'XAF',
      });

      const updatedPayment = await PaymentModel.findOneAndUpdate(
        {
          _id: payment._id,
          status: 'pending',
          providerTransactionId: null,
        },
        {
          $set: {
            providerTransactionId: startResult.providerTransactionId,
            simulation: startResult.simulation,
          },
        },
        { new: true, runValidators: true },
      ).exec();

      if (!updatedPayment) {
        throw new Error('The payment attempt could not be updated.');
      }

      return {
        payment: this.toPublicPayment(updatedPayment.toObject() as Payment),
        reused: false,
      };
    } catch (error) {
      await PaymentModel.updateOne(
        { _id: payment._id, status: 'pending' },
        {
          $set: {
            status: 'failed',
            failedAt: new Date(),
          },
        },
      ).exec();

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        statusCode: 502,
        code: 'PAYMENT_PROVIDER_START_FAILED',
        message: 'The payment attempt could not be started.',
      });
    }
  }

  /** Retrieves an integrated payment owned by the customer for this checkout. */
  async getPaymentStatus(
    customerId: string,
    checkoutId: string,
    paymentId: string,
  ): Promise<PublicPayment> {
    if (
      !mongoose.isValidObjectId(customerId) ||
      !mongoose.isValidObjectId(checkoutId) ||
      !mongoose.isValidObjectId(paymentId)
    ) {
      throw this.paymentNotFoundError();
    }

    const payment = await PaymentModel.findOne({
      _id: new mongoose.Types.ObjectId(paymentId),
      checkoutId: new mongoose.Types.ObjectId(checkoutId),
      customerId: new mongoose.Types.ObjectId(customerId),
      method: 'integrated',
    }).exec();

    if (!payment) {
      throw this.paymentNotFoundError();
    }

    return this.toPublicPayment(payment.toObject() as Payment);
  }

  private assertSameRequest(
    payment: Payment,
    checkoutId: Types.ObjectId,
    provider: CreateIntegratedPaymentInput['provider'],
  ): void {
    if (
      payment.checkoutId.toString() !== checkoutId.toString() ||
      payment.provider !== provider ||
      payment.method !== 'integrated'
    ) {
      throw new AppError({
        statusCode: 409,
        code: 'PAYMENT_IDEMPOTENCY_KEY_REUSED',
        message: 'This Idempotency-Key was already used for another request.',
      });
    }
  }

  private toPublicPayment(payment: Payment): PublicPayment {
    return {
      id: payment._id.toString(),
      checkoutId: payment.checkoutId.toString(),
      reference: payment.reference,
      method: 'integrated',
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      sellerOrderAllocations: payment.sellerOrderAllocations.map(
        (allocation) => ({
          sellerOrderId: allocation.sellerOrderId.toString(),
          sellerId: allocation.sellerId.toString(),
          storeId: allocation.storeId.toString(),
          amount: allocation.amount,
        }),
      ),
      simulation: payment.simulation,
      paymentDeadlineAt: payment.paymentDeadlineAt,
      createdAt: payment.createdAt,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private checkoutNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'CHECKOUT_SESSION_NOT_FOUND',
      message: 'Checkout session not found.',
    });
  }

  private activePaymentExistsError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'PAYMENT_ATTEMPT_ALREADY_ACTIVE',
      message: 'An integrated payment attempt is already active for checkout.',
    });
  }

  private paymentNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'PAYMENT_NOT_FOUND',
      message: 'Payment not found.',
    });
  }
}

export const paymentService = new PaymentService();
