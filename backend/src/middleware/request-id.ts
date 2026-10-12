import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestIdMiddleware: RequestHandler = (_req, res, next) => {
  const requestId = randomUUID();

  res.setHeader('X-Request-ID', requestId);

  res.locals.requestId = requestId;

  next();
};
