import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/baseline',
  outputDir: 'test-results/live-baseline',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/live-baseline-results.json' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://pillb.github.io/vision-agent-peru/',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium-live-baseline', use: { ...devices['Desktop Chrome'] } }],
})
