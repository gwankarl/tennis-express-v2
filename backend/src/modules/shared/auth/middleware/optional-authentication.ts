import type { RequestHandler } from 'express';

import { createRequireAuthentication } from './require-authentication.js';

const requireAuthentication = createRequireAuthentication();

/** Allows anonymous requests while validating supplied authentication credentials. */
export const optionalAuthentication: RequestHandler = (req, res, next) => {
  if (!req.get('authorization')) {
    next();
    return;
  }

  requireAuthentication(req, res, next);
};
