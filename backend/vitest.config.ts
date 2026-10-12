import { defineConfig } from 'vitest/config';

declare module 'vitest' {
  export interface ProvidedContext {
    mongodbUri: string;
  }
}

export default defineConfig({
  test: {
    globalSetup: ['./tests/setup/global-setup.ts'],
    setupFiles: ['./tests/setup/test-setup.ts'],
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
});
