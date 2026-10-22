import { env } from '../../../../config/env.js';
import type { PaymentProvider } from '../types/payment.types.js';
import type { IntegratedPaymentProvider } from './payment-provider.types.js';
import { PaymentProviderError } from './payment-provider.types.js';
import { PaymentProvider1Mock } from './payment-provider-1.mock.js';
import { PaymentProvider2Mock } from './payment-provider-2.mock.js';

/**
 * Creates the configured mock payment adapter.
 *
 * Payment simulation must be explicitly enabled in backend environment
 * configuration before an integrated mock attempt can be started.
 */
export function createPaymentProvider(
  provider: PaymentProvider,
): IntegratedPaymentProvider {
  if (!env.paymentSimulationEnabled) {
    throw new PaymentProviderError(
      'PAYMENT_SIMULATION_DISABLED',
      'Integrated payment simulation is disabled.',
    );
  }

  switch (provider) {
    case 'payment_provider_1':
      return new PaymentProvider1Mock(
        env.mockPaymentProvider1Scenario,
        env.mockPaymentProcessingDelayMs,
      );

    case 'payment_provider_2':
      return new PaymentProvider2Mock(
        env.mockPaymentProvider2Scenario,
        env.mockPaymentProcessingDelayMs,
      );

    default: {
      const unsupportedProvider: never = provider;
      throw new Error(`Unsupported payment provider: ${unsupportedProvider}`);
    }
  }
}
