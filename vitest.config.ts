import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'content/**/*.spec.ts', 'tests/sim/**/*.spec.ts', 'tools/**/*.spec.ts'],
  },
});
