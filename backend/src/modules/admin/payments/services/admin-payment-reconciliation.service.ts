import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { PaymentInventoryService } from '../../../shared/payments/services/payment-inventory.service.js';
import { PaymentModel } from '../../../shared/payments/models/payment.model.js';
import type { Payment } from '../../../shared/payments/types/payment.types.js';
import type { PaymentReconciliationDecisionInput } from '../validations/payment-reconciliation.schema.js';

const paymentInventoryService = new PaymentInventoryService();

const RECONCILABLE_PAYMENT_STATUSES = [
  'simulated_success',
  'reconciliation_required',
] as const;

interface AdminPaymentSummary {
  id: string;
  checkoutId: string;
  customerId: string;
  reference: string;
  method: Payment['method'];
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
  directPaymentDeclaration: Payment['directPaymentDeclaration'];
  simulation: Payment['simulation'];
  reconciliation: Payment['reconciliation'];
  paymentDeadlineAt: Date;
  createdAt: Date;
}

interface ReconcilePaymentResult {
  payment: AdminPaymentSummary;
  reused: boolean;
}

/** Lists and reconciles direct and simulated payment records for admins. */
export class AdminPaymentReconciliationService {
  /** Returns a bounded queue of payments awaiting administrative review. */
  async getQueue(): Promise<AdminPaymentSummary[]> {
    const payments = await PaymentModel.find({
      $or: [
        { method: 'direct', status: 'pending' },
        { status: { $in: RECONCILABLE_PAYMENT_STATUSES } },
      ],
    })
      .select('-idempotencyKey')
      .sort({ createdAt: 1 })
      .limit(100)
      .exec();

    return payments.map((payment) =>
      this.toAdminPayment(payment.toObject() as Payment),
    );
  }

  /** Approves or rejects one payment inside an inventory-safe transaction. */
  async reconcile(
    adminId: string,
    paymentId: string,
    input: PaymentReconciliationDecisionInput,
  ): Promise<ReconcilePaymentResult> {
    if (
      !mongoose.isValidObjectId(adminId) ||
      !mongoose.isValidObjectId(paymentId)
    ) {
      throw this.paymentNotFoundError();
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminId);
    const paymentObjectId = new mongoose.Types.ObjectId(paymentId);
    const now = new Date();
    const mongoSession = await mongoose.startSession();

    try {
      const result = await mongoSession.withTransaction<ReconcilePaymentResult>(
        async () => {
          const payment = await PaymentModel.findById(paymentObjectId)
            .session(mongoSession)
            .exec();

          if (!payment) {
            throw this.paymentNotFoundError();
          }

          if (
            payment.reconciliation.reviewedAt &&
            payment.reconciliation.decision
          ) {
            if (payment.reconciliation.decision !== input.decision) {
              throw this.alreadyReconciledError();
            }

            return {
              payment: this.toAdminPayment(payment.toObject() as Payment),
              reused: true,
            };
          }

          const isDirectPending =
            payment.method === 'direct' && payment.status === 'pending';
          const isReconciliationCandidate =
            payment.method === 'integrated' &&
            RECONCILABLE_PAYMENT_STATUSES.includes(
              payment.status as (typeof RECONCILABLE_PAYMENT_STATUSES)[number],
            );

          if (!isDirectPending && !isReconciliationCandidate) {
            throw this.notReconciliationCandidateError();
          }

          if (
            payment.isSimulated &&
            payment.paymentDeadlineAt.getTime() <= now.getTime()
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'PAYMENT_DEADLINE_PASSED',
              message:
                'This simulated payment has passed its deadline and cannot be reconciled.',
            });
          }

          this.assertPaymentAllocations(payment.toObject() as Payment);

          if (
            input.decision === 'approved' &&
            payment.status === 'reconciliation_required' &&
            !input.note?.trim()
          ) {
            throw new AppError({
              statusCode: 400,
              code: 'RECONCILIATION_NOTE_REQUIRED',
              message:
                'Provide an audit note when approving a payment with a reported mismatch.',
            });
          }

          if (
            input.decision === 'approved' &&
            payment.method === 'direct' &&
            (!payment.directPaymentDeclaration ||
              payment.directPaymentDeclaration.amount !== payment.amount)
          ) {
            throw new AppError({
              statusCode: 409,
              code: 'DIRECT_PAYMENT_DECLARATION_INVALID',
              message:
                'The direct-payment declaration does not match the recorded payment amount.',
            });
          }

          if (input.decision === 'approved') {
            await paymentInventoryService.confirm(
              payment.toObject() as Payment,
              mongoSession,
            );

            payment.status = 'confirmed';
            payment.confirmedAt = now;
          } else {
            await paymentInventoryService.reject(
              payment.toObject() as Payment,
              now,
              mongoSession,
            );

            payment.status = 'failed';
            payment.failedAt = now;
          }

          payment.reconciliation = {
            reviewedBy: adminObjectId,
            reviewedAt: now,
            decision: input.decision,
            note: input.note?.trim() || null,
          };

          await payment.save({ session: mongoSession });

          return {
            payment: this.toAdminPayment(payment.toObject() as Payment),
            reused: false,
          };
        },
      );

      if (!result) {
        throw new Error('Payment reconciliation completed without a result.');
      }

      return result;
    } finally {
      await mongoSession.endSession();
    }
  }

  private assertPaymentAllocations(payment: Payment): void {
    const allocationTotal = payment.sellerOrderAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );

    if (
      payment.sellerOrderAllocations.length === 0 ||
      !Number.isSafeInteger(allocationTotal) ||
      allocationTotal !== payment.amount
    ) {
      throw new AppError({
        statusCode: 409,
        code: 'PAYMENT_ALLOCATIONS_INVALID',
        message: 'The payment allocations do not match the payment amount.',
      });
    }
  }

  private toAdminPayment(payment: Payment): AdminPaymentSummary {
    return {
      id: payment._id.toString(),
      checkoutId: payment.checkoutId.toString(),
      customerId: payment.customerId.toString(),
      reference: payment.reference,
      method: payment.method,
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
      directPaymentDeclaration: payment.directPaymentDeclaration,
      simulation: payment.simulation,
      reconciliation: payment.reconciliation,
      paymentDeadlineAt: payment.paymentDeadlineAt,
      createdAt: payment.createdAt,
    };
  }

  private paymentNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'PAYMENT_NOT_FOUND',
      message: 'Payment not found.',
    });
  }

  private alreadyReconciledError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'PAYMENT_ALREADY_RECONCILED',
      message: 'This payment was already reconciled with a different decision.',
    });
  }

  private notReconciliationCandidateError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'PAYMENT_NOT_RECONCILABLE',
      message: 'This payment is not awaiting reconciliation.',
    });
  }
}

export const adminPaymentReconciliationService =
  new AdminPaymentReconciliationService();
