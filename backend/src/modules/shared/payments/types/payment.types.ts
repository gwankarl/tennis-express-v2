import type { Types } from 'mongoose';

export const PAYMENT_METHODS = ['integrated', 'direct'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = [
  'payment_provider_1',
  'payment_provider_2',
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'simulated_success',
  'confirmed',
  'failed',
  'cancelled',
  'expired',
  'reconciliation_required',
  'partially_refunded',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MOCK_PAYMENT_SCENARIOS = [
  'success',
  'failure',
  'cancelled',
  'pending',
  'timeout',
  'provider_error',
  'amount_mismatch',
  'currency_mismatch',
  'duplicate_notification',
] as const;
export type MockPaymentScenario = (typeof MOCK_PAYMENT_SCENARIOS)[number];

export const DIRECT_PAYMENT_CHANNELS = [
  'cash',
  'bank_transfer',
  'mobile_money',
  'other',
] as const;
export type DirectPaymentChannel = (typeof DIRECT_PAYMENT_CHANNELS)[number];

export interface SellerOrderPaymentAllocation {
  sellerOrderId: Types.ObjectId;
  sellerId: Types.ObjectId;
  storeId: Types.ObjectId;
  amount: number;
  refundedAmount: number;
}

export interface DirectPaymentDeclaration {
  declaredBy: Types.ObjectId;
  declaredAt: Date;
  channel: DirectPaymentChannel;
  amount: number;
  receivedAt: Date;
  reference: string | null;
  evidenceReference: string | null;
  note: string | null;
}

export interface PaymentReconciliation {
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  decision: 'approved' | 'rejected' | null;
  note: string | null;
}

export interface PaymentSimulation {
  scenario: MockPaymentScenario;
  scheduledAt: Date | null;
  processedAt: Date | null;
  reportedAmount: number | null;
  reportedCurrency: string | null;
}

export interface Payment {
  _id: Types.ObjectId;
  checkoutId: Types.ObjectId;
  customerId: Types.ObjectId;
  method: PaymentMethod;
  provider: PaymentProvider | null;
  providerTransactionId: string | null;
  reference: string;
  idempotencyKey: string;
  status: PaymentStatus;
  isSimulated: boolean;
  amount: number;
  currency: 'XAF';
  sellerOrderAllocations: SellerOrderPaymentAllocation[];
  directPaymentDeclaration: DirectPaymentDeclaration | null;
  reconciliation: PaymentReconciliation;
  simulation: PaymentSimulation | null;
  paymentDeadlineAt: Date;
  confirmedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
