import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
          exclude: ['src/**/*.perf.spec.ts'],
          environment: 'node',
        },
      },
      {
        // Wall-clock SLAs: kept out of the coverage-instrumented unit gate on the OS matrix and run
        // on a dedicated Linux step (aws-icons spec §5).
        test: {
          name: 'perf',
          include: ['src/**/*.perf.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'golden',
          include: ['test/golden/**/*.spec.ts'],
          environment: 'node',
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.spec.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts', 'src/index.ts', 'src/cli/bin.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ['text', 'lcov'],
    },
  },
});
