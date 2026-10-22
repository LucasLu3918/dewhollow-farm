import { defineConfig, devices } from '@playwright/test';

const nodeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process;
const e2eBaseURL = nodeProcess?.env?.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const pwaBaseURL = nodeProcess?.env?.PWA_BASE_URL ?? 'http://127.0.0.1:4173';
const e2eBase = new URL(e2eBaseURL);
const pwaBase = new URL(pwaBaseURL);
const devPort = e2eBase.port || '5173';
const previewPort = pwaBase.port || '4173';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: e2eBaseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npm run dev -- --host ${e2eBase.hostname} --port ${devPort} --strictPort`,
      url: e2eBaseURL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    // PWA（tests/e2e/pwa.spec.ts）只在正式建置註冊 service worker，所以另外用建置後的 preview（4173）。
    {
      command: `npm run build && npm run preview -- --host ${pwaBase.hostname} --port ${previewPort} --strictPort`,
      url: pwaBaseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
