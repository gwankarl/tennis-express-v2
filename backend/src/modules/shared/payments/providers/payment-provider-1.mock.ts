import type { MockPaymentScenario } from '../types/payment.types.js';
import { MockIntegratedPaymentProvider } from './mock-integrated-payment-provider.js';

/** Mock adapter for Payment-Provider 1. */
export class PaymentProvider1Mock extends MockIntegratedPaymentProvider {
  constructor(scenario: MockPaymentScenario, processingDelayMs: number) {
    super({
      provider: 'payment_provider_1',
      scenario,
      processingDelayMs,
    });
  }
}
