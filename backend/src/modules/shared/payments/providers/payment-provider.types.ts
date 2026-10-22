import type {
  MockPaymentScenario,
  PaymentProvider,
  PaymentSimulation,
} from '../types/payment.types.js';

/** Input required to start an integrated payment attempt. */
export interface StartMockPaymentInput {
  /** Internal payment reference used to derive a stable mock transaction ID. */
  reference: string;
  /** Expected payment amount in XAF. */
  amount: number;
  /** Integrated checkout payments use XAF. */
  currency: 'XAF';
  /** Optional clock value for deterministic processing. */
  now?: Date;
}

/** Result returned when the mock provider accepts an attempt. */
export interface StartMockPaymentResult {
  providerTransactionId: string;
  status: 'pending';
  simulation: PaymentSimulation;
}

/** Input used later to process a scheduled mock payment scenario. */
export interface ResolveMockPaymentInput {
  providerTransactionId: string;
  amount: number;
  currency: 'XAF';
  simulation: PaymentSimulation;
  now?: Date;
}

/** Statuses that a mock provider may produce during scenario processing. */
export type MockPaymentResolutionStatus =
  | 'simulated_success'
  | 'failed'
  | 'cancelled'
  | 'pending'
  | 'reconciliation_required';

/** Processed result for a mock provider scenario. */
export interface ResolveMockPaymentResult {
  providerTransactionId: string;
  status: MockPaymentResolutionStatus;
  /** Amount reported by the simulated provider. */
  amount: number;
  /** Currency reported by the simulated provider. */
  currency: string;
  /** Two indicates that the same result should be delivered twice downstream. */
  notificationCount: 1 | 2;
  processedAt: Date | null;
}

/** Shared contract for the integrated mock payment providers. */
export interface IntegratedPaymentProvider {
  readonly provider: PaymentProvider;

  /**
   * Creates a pending attempt and records when its scenario can be processed.
   */
  start(input: StartMockPaymentInput): Promise<StartMockPaymentResult>;

  /**
   * Resolves a previously started attempt when its scheduled time has arrived.
   */
  resolve(input: ResolveMockPaymentInput): Promise<ResolveMockPaymentResult>;
}

/** Options used to configure one mock provider instance. */
export interface MockIntegratedPaymentProviderOptions {
  provider: PaymentProvider;
  scenario: MockPaymentScenario;
  processingDelayMs: number;
}

/** Error codes callers can use to classify mock-provider failures. */
export type PaymentProviderErrorCode =
  | 'PAYMENT_SIMULATION_DISABLED'
  | 'PAYMENT_PROVIDER_TRANSACTION_INVALID'
  | 'PAYMENT_SIMULATION_NOT_READY'
  | 'PAYMENT_AMOUNT_INVALID';

/** Represents a classified error from a payment-provider adapter. */
export class PaymentProviderError extends Error {
  constructor(
    public readonly code: PaymentProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
