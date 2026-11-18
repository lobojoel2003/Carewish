import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/server/**/*.ts',
        'src/i18n/index.ts',
        'src/app/api/**/*.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
});
