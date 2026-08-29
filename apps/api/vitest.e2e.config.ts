import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './test/test-env';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: { ...TEST_ENV },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
