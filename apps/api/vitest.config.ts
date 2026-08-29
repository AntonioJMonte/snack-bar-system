import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Plugin SWC obrigatório: o NestJS depende de emitDecoratorMetadata,
// que o esbuild padrão do Vitest não suporta (decisão #12).
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
