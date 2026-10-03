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
    // The app starts with no place; Analyze and saves use the device position.
    geolocation: { latitude: -30.7489, longitude: 121.4658 },
    permissions: ["geolocation"],
  },
});
