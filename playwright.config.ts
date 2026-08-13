import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '../tmp/playwright-extension-results',
  reporter: 'line',
  timeout: 90_000,
})
