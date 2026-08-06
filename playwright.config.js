// @ts-check
const { defineConfig, devices } = require('playwright/test')

/**
 * Playwright configuration for Vision Agent Perú.
 *
 * This config drives the FORMAL Playwright Test suite (scripts/playwright/*.spec.ts)
 * which tests the UI through VISIBLE CONTROLS only — no window.__visionStore,
 * no direct Zustand mutation, no internal navigation, no raw DOM click dispatch.
 *
 * The suite runs against the dev server (localhost:3000) by default. For
 * production-preview validation, set BASE_URL=https://pillb.github.io/vision-agent-peru/
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

module.exports = defineConfig({
  testDir: './scripts/playwright',
  fullyParallel: false,  // sequential — dev server has limited memory
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,  // single worker — canvas/video resources can't be shared
  reporter: [
    ['list'],
    ['json', { outputFile: '/tmp/pw-vision-agent/formal-results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',  // video recording slows down tests significantly
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 90_000,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-translate',
        '--disable-sync',
        '--disable-component-update',
        '--no-first-run',
        '--disable-breakpad',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--renderer-process-limit=2',
        '--enable-features=VaapiVideoDecoder,VaapiVideoEncoder',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--memory-pressure-off',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Cross-browser validation — uncomment when ready for full matrix.
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // We manage the dev server separately (npm run dev in a persistent shell)
  // to avoid Playwright's webServer killing it between tests.
  // Tests will skip themselves with a clear message if server is unreachable.
})
