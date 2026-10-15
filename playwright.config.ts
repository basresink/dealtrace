import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// E2E tegen de lokale server (pnpm dev). Draai eerst pnpm db:reset voor een schone stand.
const chromium = existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}
const mobiel = (breedte: number) => ({ ...devices['Pixel 7'], viewport: { width: breedte, height: 844 }, launchOptions: chromium })

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', testIdAttribute: 'data-test' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000/login', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, launchOptions: chromium }, testIgnore: /mobiel/ },
    { name: 'mobiel-375', use: mobiel(375), testMatch: /mobiel/ },
    { name: 'mobiel-390', use: mobiel(390), testMatch: /mobiel/ },
    { name: 'mobiel-412', use: mobiel(412), testMatch: /mobiel/ },
  ],
})
