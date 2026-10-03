import { defineConfig } from "@playwright/test";
import mobile from "./playwright.mobile.config";

// Presses every control on every tab; needs the API, worker, Expo web and local AI running.
export default defineConfig({ ...mobile, testDir: "./tests/audit", timeout: 1_600_000 });
