import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';

import v1Router from './routes/v1/index.js';

export function createApp() {
  const app = express();

  app.use(helmet());

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

        if (!origin || origin === allowedOrigin) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use('/api/v1', v1Router);

  // Handle requests that did not match a registered route.
  app.use(notFoundHandler);

  // Centralized error handling must be registered last.
  app.use(errorHandler);

  return app;
}
