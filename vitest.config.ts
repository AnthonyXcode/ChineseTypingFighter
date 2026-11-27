import { defineConfig } from 'vitest/config';

// Unit tests only (Playwright e2e lives in tests/e2e and runs separately).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts', 'src/engine/testFixtures.ts'],
      reporter: ['text', 'html'],
    },
  },
});
