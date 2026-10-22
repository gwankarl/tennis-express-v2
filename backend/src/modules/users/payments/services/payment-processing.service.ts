import mongoose from 'mongoose';
import type { Types } from 'mongoose';

import { PaymentModel } from '../../../shared/payments/models/payment.model.js';
import { createPaymentProvider } from '../../../shared/payments/providers/payment-provider.factory.js';
import type {
  Payment,
  PaymentStatus,
} from '../../../shared/payments/types/payment.types.js';
import type { ResolveMockPaymentResult } from '../../../shared/payments/providers/payment-provider.types.js';
import { paymentInventoryService } from '../../../shared/payments/services/payment-inventory.service.js';

const EXPIRABLE_PAYMENT_STATUSES = [
  'pending',
  'simulated_success',
  'reconciliation_required',
] as const;

interface PaymentProcessingResult {
  outcomesProcessed: number;
  paymentsExpired: number;
}

/** Processes mock payment outcomes and expires unpaid orders. */
export class PaymentProcessingService {
  /**
   * Processes due mock outcomes first, then expires overdue unpaid attempts.
   */
  async processDuePayments(
    now = new Date(),
    batchSize = 100,
  ): Promise<PaymentProcessingResult> {
    const duePayments = await PaymentModel.find({
      method: 'integrated',
      isSimulated: true,
      status: 'pending',
      'simulation.scheduledAt': { $ne: null, $lte: now },
      'simulation.processedAt': null,
    })
      .sort({ 'simulation.scheduledAt': 1 })
      .limit(batchSize)
      .exec();

    let outcomesProcessed = 0;

    for (const payment of duePayments) {
      if (
        !payment.provider ||
        !payment.providerTransactionId ||
        !payment.simulation
      ) {
        console.error(
          `Cannot process payment ${payment._id.toString()}: provider details are incomplete.`,
        );
        continue;
      }

      try {
        const provider = createPaymentProvider(payment.provider);
        const outcome = await provider.resolve({
          providerTransactionId: payment.providerTransactionId,
          amount: payment.amount,
          currency: payment.currency,
          simulation: payment.simulation,
          now,
        });

        /*
         * The duplicate-notification scenario applies the same result twice.
         * The transactional status check makes the second application a no-op.
         */
        for (
          let notification = 0;
          notification < outcome.notificationCount;
          notification += 1
        ) {
          const applied = await this.applyMockOutcome(
            payment._id,
            outcome,
            now,
          );

          if (applied) {
            outcomesProcessed += 1;
          }
        }
      } catch (error) {
        console.error(
          `Failed to process mock payment ${payment._id.toString()}:`,
          error,
        );
      }
    }

    const overduePayments = await PaymentModel.find({
      method: 'integrated',
      isSimulated: true,
      status: { $in: EXPIRABLE_PAYMENT_STATUSES },
      paymentDeadlineAt: { $lte: now },
    })
      .sort({ paymentDeadlineAt: 1 })
      .limit(batchSize)
      .exec();

    let paymentsExpired = 0;

    for (const payment of overduePayments) {
      try {
        if (await this.expirePayment(payment._id, now)) {
          paymentsExpired += 1;
        }
      } catch (error) {
        console.error(
          `Failed to expire payment ${payment._id.toString()}:`,
          error,
        );
      }
    }

    return { outcomesProcessed, paymentsExpired };
  }

  /**
   * Persists a mock outcome once and releases stock for failed or cancelled
   * attempts. Successful simulations remain unconfirmed and keep their stock
   * until payment confirmation or deadline expiry.
   */
  private async applyMockOutcome(
    paymentId: Types.ObjectId,
    outcome: ResolveMockPaymentResult,
    now: Date,
  ): Promise<boolean> {
    const mongoSession = await mongoose.startSession();

    try {
      return await mongoSession.withTransaction(async () => {
        const payment = await PaymentModel.findOne({
          _id: paymentId,
          method: 'integrated',
          isSimulated: true,
          status: 'pending',
          'simulation.processedAt': null,
        })
          .session(mongoSession)
          .exec();

        if (!payment || !payment.simulation) {
          return false;
        }

        const matchesExpectedAmount =
          outcome.amount === payment.amount &&
          outcome.currency === payment.currency;

        const nextStatus: PaymentStatus = matchesExpectedAmount
          ? outcome.status
          : 'reconciliation_required';

        if (nextStatus === 'failed' || nextStatus === 'cancelled') {
          await paymentInventoryService.reject(
            payment.toObject() as Payment,
            now,
            mongoSession,
          );
        }

        payment.status = nextStatus;

        if (nextStatus === 'failed') {
          payment.failedAt = now;
        } else if (nextStatus === 'cancelled') {
          payment.cancelledAt = now;
        }

        payment.simulation.processedAt = outcome.processedAt;
        payment.simulation.reportedAmount = outcome.amount;
        payment.simulation.reportedCurrency = outcome.currency;

        await payment.save({ session: mongoSession });
        return true;
      });
    } finally {
      await mongoSession.endSession();
    }
  }

  /** Expires an overdue attempt and releases its committed inventory. */
  private async expirePayment(
    paymentId: Types.ObjectId,
    now: Date,
  ): Promise<boolean> {
    const mongoSession = await mongoose.startSession();

    try {
      return await mongoSession.withTransaction(async () => {
        const payment = await PaymentModel.findOne({
          _id: paymentId,
          method: 'integrated',
          isSimulated: true,
          status: { $in: EXPIRABLE_PAYMENT_STATUSES },
          paymentDeadlineAt: { $lte: now },
        })
          .session(mongoSession)
          .exec();

        if (!payment) {
          return false;
        }

        await paymentInventoryService.reject(
          payment.toObject() as Payment,
          now,
          mongoSession,
        );

        payment.status = 'expired';
        payment.expiredAt = now;
        await payment.save({ session: mongoSession });

        return true;
      });
    } finally {
      await mongoSession.endSession();
    }
  }
}

export const paymentProcessingService = new PaymentProcessingService();
