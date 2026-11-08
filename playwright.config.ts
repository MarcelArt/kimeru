import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: ".verification/browser",
  use: {
    baseURL: "http://127.0.0.1:4176",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm start",
    url: "http://127.0.0.1:4176/healthz",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      KIMERU_DATA_DIR: mkdtempSync(join(tmpdir(), "kimeru-e2e-")),
      PORT: "4176",
      HOST: "127.0.0.1",
      KIMERU_APP_ORIGIN: "http://127.0.0.1:4176",
    },
  },
});
