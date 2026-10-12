import { createApp } from './app.js';
import { env } from './config/env.js';
import {
  connectToDatabase,
  disconnectFromDatabase,
} from './config/database/mongodb.js';

const startServer = async (): Promise<void> => {
  await connectToDatabase();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });

  let isShuttingDown = false;

  const shutdown = (signal: string): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
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
