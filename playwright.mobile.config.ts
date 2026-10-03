import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/mobile",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:8081",
    channel: "msedge",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    trace: "retain-on-failure",
  },
});
