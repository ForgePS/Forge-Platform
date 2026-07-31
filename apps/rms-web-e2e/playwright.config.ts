import "./src/load-env.js";
import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import { getBaseUrl, getStorageStatePath, hasPrimaryCredentials } from "./src/env.js";

const storageStatePath = getStorageStatePath();
const storageStateExists = storageStatePath ? fs.existsSync(storageStatePath) : false;

const config = {
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["html", { open: "never" }], ["list"]],
  ...(hasPrimaryCredentials() ? { globalSetup: "./global-setup.ts" } : {}),
  use: {
    baseURL: getBaseUrl(),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...(storageStateExists && storageStatePath ? { storageState: storageStatePath } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
} satisfies Parameters<typeof defineConfig>[0];

export default defineConfig(config as Parameters<typeof defineConfig>[0]);
