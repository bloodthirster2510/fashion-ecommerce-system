import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.unit.spec.ts',
  timeout: 10_000,
  fullyParallel: true,
  reporter: 'list',
})
