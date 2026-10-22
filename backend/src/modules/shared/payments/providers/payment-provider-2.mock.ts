import type { MockPaymentScenario } from '../types/payment.types.js';
import { MockIntegratedPaymentProvider } from './mock-integrated-payment-provider.js';

/** Mock adapter for Payment-Provider 2. */
export class PaymentProvider2Mock extends MockIntegratedPaymentProvider {
  constructor(scenario: MockPaymentScenario, processingDelayMs: number) {
    super({
      provider: 'payment_provider_2',
      scenario,
      processingDelayMs,
    });
  }
}
