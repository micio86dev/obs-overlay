import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";

const temporaryDirectory = process.env.RUNNER_TEMP ?? tmpdir();

export default defineConfig({
  testDir: "./tests",
  testMatch: ["production-config.pw.ts", "production-placement.pw.ts", "production-preview.pw.ts"],
  forbidOnly: true,
  outputDir: `${temporaryDirectory}/obs-overlay-playwright-production`,
  use: {
    baseURL: "http://127.0.0.1:4174"
  },
  webServer: {
    command: `VITE_CACHE_DIR=${temporaryDirectory}/obs-overlay-vite-production VITE_OUT_DIR=${temporaryDirectory}/obs-overlay-production-build node node_modules/vue-tsc/bin/vue-tsc.js -b --pretty false && VITE_CACHE_DIR=${temporaryDirectory}/obs-overlay-vite-production VITE_OUT_DIR=${temporaryDirectory}/obs-overlay-production-build node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --outDir ${temporaryDirectory}/obs-overlay-production-build --host 127.0.0.1 --port 4174`,
    port: 4174,
    reuseExistingServer: false
  }
});
