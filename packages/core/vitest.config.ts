import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: '@vitest/coverage-v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/mtpc.ts',
        'src/types/index.ts',
        'src/resource/utils.ts',
        'src/resource/builder.ts',
      ],
      reports: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
