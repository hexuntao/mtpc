import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 1,
        minThreads: 1,
      },
    },
    isolate: false,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
