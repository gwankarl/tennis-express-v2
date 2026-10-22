import { createApp } from './app.js';
import { env } from './config/env.js';
import {
  connectToDatabase,
  disconnectFromDatabase,
} from './config/database/mongodb.js';
import { checkoutSessionService } from './modules/users/checkout/services/checkout-session.service.js';
import { paymentProcessingService } from './modules/users/payments/services/payment-processing.service.js';

const CHECKOUT_CLEANUP_INTERVAL_MS = 60_000;

const runCheckoutCleanup = (): void => {
  void checkoutSessionService
    .expireDueReservations()
    .catch((error: unknown) => {
      console.error('Failed to release expired checkout reservations:', error);
    });
};

const runPaymentProcessing = (): void => {
  void paymentProcessingService.processDuePayments().catch((error: unknown) => {
    console.error('Failed to process due payments:', error);
  });
};

const startServer = async (): Promise<void> => {
  await connectToDatabase();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });

  runCheckoutCleanup();
  runPaymentProcessing();

  const checkoutCleanupTimer = setInterval(
    runCheckoutCleanup,
    CHECKOUT_CLEANUP_INTERVAL_MS,
  );

  checkoutCleanupTimer.unref();

  const paymentProcessingTimer = setInterval(
    runPaymentProcessing,
    CHECKOUT_CLEANUP_INTERVAL_MS,
  );

  paymentProcessingTimer.unref();

  let isShuttingDown = false;

  const shutdown = (signal: string): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    clearInterval(checkoutCleanupTimer);
    clearInterval(paymentProcessingTimer);
    console.log(`${signal} received. Shutting down gracefully.`);

    server.close((error) => {
      void (async () => {
        try {
          await disconnectFromDatabase();

          if (error) {
            throw error;
          }

          console.log('HTTP server and MongoDB connection closed.');
        } catch (shutdownError) {
          console.error('Error during shutdown:', shutdownError);
          process.exitCode = 1;
        }
      })();
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

void startServer().catch((error: unknown) => {
  console.error('Failed to start the backend:', error);
  process.exitCode = 1;
});
