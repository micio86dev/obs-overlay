import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";

const temporaryDirectory = process.env.RUNNER_TEMP ?? tmpdir();

export default defineConfig({
  testDir: "./tests",
  testMatch: "screen-camera.pw.ts",
  forbidOnly: true,
  outputDir: `${temporaryDirectory}/obs-overlay-playwright-demo`,
  use: {
    baseURL: "http://127.0.0.1:4173"
  },
  webServer: {
    command: `VITE_CACHE_DIR=${temporaryDirectory}/obs-overlay-vite-demo VITE_DEMO_MODE=true node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173`,
    port: 4173,
    reuseExistingServer: false
  }
});
