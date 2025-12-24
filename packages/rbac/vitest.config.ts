import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // 使用单线程避免内存问题
        maxThreads: 1,
        minThreads: 1,
      },
    },
    isolate: false, // 禁用测试隔离
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
