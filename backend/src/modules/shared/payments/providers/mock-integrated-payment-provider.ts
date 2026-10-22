import { createHash } from 'node:crypto';

import type {
  MockPaymentScenario,
  PaymentProvider,
} from '../types/payment.types.js';
import type {
  IntegratedPaymentProvider,
  MockIntegratedPaymentProviderOptions,
  ResolveMockPaymentInput,
  ResolveMockPaymentResult,
  StartMockPaymentInput,
  StartMockPaymentResult,
} from './payment-provider.types.js';
import { PaymentProviderError } from './payment-provider.types.js';

/**
 * Common implementation for the two integrated mock payment providers.
 *
 * Scenario results are deliberately simulated. Even a successful scenario
 * returns `simulated_success`; a separate reconciliation flow must confirm
 * a payment before orders can be treated as paid.
 */
export class MockIntegratedPaymentProvider implements IntegratedPaymentProvider {
  public readonly provider: PaymentProvider;

  private readonly scenario: MockPaymentScenario;
  private readonly processingDelayMs: number;

  constructor(options: MockIntegratedPaymentProviderOptions) {
    this.provider = options.provider;
    this.scenario = options.scenario;
    this.processingDelayMs = options.processingDelayMs;
  }

  /**
   * Starts a mock payment attempt with a stable provider transaction ID.
   */
  async start(input: StartMockPaymentInput): Promise<StartMockPaymentResult> {
    this.validateAmount(input.amount);

    const now = input.now ?? new Date();
    const neverSchedulesResult =
      this.scenario === 'pending' || this.scenario === 'timeout';

    return {
      providerTransactionId: this.createTransactionId(input.reference),
      status: 'pending',
      simulation: {
        scenario: this.scenario,
        scheduledAt: neverSchedulesResult
          ? null
          : new Date(now.getTime() + this.processingDelayMs),
        processedAt: null,
        reportedAmount: null,
        reportedCurrency: null,
      },
    };
  }

  /**
   * Returns the configured scenario result after its scheduled processing time.
   */
  async resolve(
    input: ResolveMockPaymentInput,
  ): Promise<ResolveMockPaymentResult> {
    this.validateAmount(input.amount);
    this.validateTransactionId(input.providerTransactionId);

    const now = input.now ?? new Date();
    const { scenario, scheduledAt } = input.simulation;

    if (scheduledAt && now.getTime() < scheduledAt.getTime()) {
      throw new PaymentProviderError(
        'PAYMENT_SIMULATION_NOT_READY',
        'The mock payment scenario is not ready to process.',
      );
    }

    if (!scheduledAt && scenario !== 'pending' && scenario !== 'timeout') {
      throw new PaymentProviderError(
        'PAYMENT_SIMULATION_NOT_READY',
        'The mock payment has no scheduled processing time.',
      );
    }

    const result = this.createScenarioResult(
      scenario,
      input.amount,
      input.currency,
      input.providerTransactionId,
      now,
    );

    return result;
  }

  private createScenarioResult(
    scenario: MockPaymentScenario,
    amount: number,
    currency: 'XAF',
    providerTransactionId: string,
    now: Date,
  ): ResolveMockPaymentResult {
    switch (scenario) {
      case 'success':
        return this.result(
          providerTransactionId,
          'simulated_success',
          amount,
          currency,
          1,
          now,
        );

      case 'failure':
      case 'provider_error':
        return this.result(
          providerTransactionId,
          'failed',
          amount,
          currency,
          1,
          now,
        );

      case 'cancelled':
        return this.result(
          providerTransactionId,
          'cancelled',
          amount,
          currency,
          1,
          now,
        );

      case 'pending':
        return this.result(
          providerTransactionId,
          'pending',
          amount,
          currency,
          1,
          null,
        );

      case 'timeout':
        /* The attempt was processed, but the provider gave no final result. */
        return this.result(
          providerTransactionId,
          'pending',
          amount,
          currency,
          1,
          now,
        );

      case 'amount_mismatch':
        return this.result(
          providerTransactionId,
          'reconciliation_required',
          amount === Number.MAX_SAFE_INTEGER ? amount - 1 : amount + 1,
          currency,
          1,
          now,
        );

      case 'currency_mismatch':
        return this.result(
          providerTransactionId,
          'reconciliation_required',
          amount,
          'XOF',
          1,
          now,
        );

      case 'duplicate_notification':
        return this.result(
          providerTransactionId,
          'simulated_success',
          amount,
          currency,
          2,
          now,
        );

      default: {
        const unsupportedScenario: never = scenario;
        throw new Error(
          `Unsupported mock payment scenario: ${unsupportedScenario}`,
        );
      }
    }
  }

  private result(
    providerTransactionId: string,
    status: ResolveMockPaymentResult['status'],
    amount: number,
    currency: string,
    notificationCount: 1 | 2,
    processedAt: Date | null,
  ): ResolveMockPaymentResult {
    return {
      providerTransactionId,
      status,
      amount,
      currency,
      notificationCount,
      processedAt,
    };
  }

  private createTransactionId(reference: string): string {
    const digest = createHash('sha256')
      .update(`${this.provider}:${reference}`)
      .digest('hex')
      .slice(0, 24);

    return `mock_${this.provider}_${digest}`;
  }

  private validateTransactionId(transactionId: string): void {
    if (!transactionId.startsWith(`mock_${this.provider}_`)) {
      throw new PaymentProviderError(
        'PAYMENT_PROVIDER_TRANSACTION_INVALID',
        'The transaction ID does not belong to this mock provider.',
      );
    }
  }

  private validateAmount(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new PaymentProviderError(
        'PAYMENT_AMOUNT_INVALID',
        'Payment amount must be a positive whole XAF amount.',
      );
    }
  }
}
