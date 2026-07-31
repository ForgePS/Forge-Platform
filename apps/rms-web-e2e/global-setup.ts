import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { getPrimaryCredentials, getStorageStatePath, hasPrimaryCredentials } from "./src/env.js";
import { ensureAuthenticated } from "./src/helpers/navigation.js";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (!hasPrimaryCredentials()) {
    return;
  }

  const storageStatePath = getStorageStatePath();
  if (!storageStatePath) {
    return;
  }

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await ensureAuthenticated(page, getPrimaryCredentials());
    await context.storageState({ path: storageStatePath });
  } finally {
    await browser.close();
  }
}
