import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/setup/global-setup.ts'],
    setupFiles: ['./tests/setup/test-setup.ts'],
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
});
