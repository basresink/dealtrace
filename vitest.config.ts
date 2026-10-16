import { defineConfig } from 'vitest/config'
// pnpm test draait tests/unit; pnpm test:db zet TEST_APP_URL en draait tests/db. De db-tests delen één
// wegwerp-database en werken soms dezelfde accounts bij; ze draaien daarom na elkaar (geen deadlocks).
export default defineConfig({
  test: { include: [process.env.TEST_APP_URL ? 'tests/db/**/*.test.ts' : 'tests/unit/**/*.test.ts'], environment: 'node', fileParallelism: !process.env.TEST_APP_URL },
})
