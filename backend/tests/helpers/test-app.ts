import type { Express } from 'express';

import { createApp } from '../../src/app.js';
import type { V1RouterDependencies } from '../../src/routes/v1/index.js';

/**
 * Creates an application instance for integration tests.
 */
export function createTestApp(
  dependencies: V1RouterDependencies = {},
): Express {
  return createApp(dependencies);
}
