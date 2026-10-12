import type { RequestHandler } from 'express';
import { logger } from '../config/logger.js';

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    logger.info(
      {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      },
      'HTTP request completed',
    );
  });

  next();
};
