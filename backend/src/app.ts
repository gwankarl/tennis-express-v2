import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';

import {
  createV1Router,
  type V1RouterDependencies,
} from './routes/v1/index.js';

/**
 * Creates and configures the Express application.
 *
 * Registers security headers, request tracking and logging, cross-origin
 * access rules, request-body parsers, API routes, and centralized error
 * handling. Dependencies are forwarded to the versioned API router.
 *
 * @param dependencies - Optional services required by API routes.
 * @returns The configured Express application.
 */
export function createApp(dependencies: V1RouterDependencies = {}) {
  const app = express();

  /* Apply standard HTTP security headers. */
  app.use(helmet());

  /* Attach request identifiers and log incoming requests. */
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  /* Parse cookies for authentication and session-management endpoints. */
  app.use(cookieParser());

  /* Restrict browser access to the configured frontend origin. */
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

  /* Parse supported request bodies with explicit size limits. */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  /* Mount all version 1 API endpoints under a shared prefix. */
  app.use('/api/v1', createV1Router(dependencies));

  /* Handle requests that did not match a registered route. */
  app.use(notFoundHandler);

  /* Centralized error handling must be registered after routes and fallbacks. */
  app.use(errorHandler);

  return app;
}
