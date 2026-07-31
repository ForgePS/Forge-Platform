import { test as base, expect, type Page } from "@playwright/test";
import { getPrimaryCredentials, hasPrimaryCredentials, SKIP_NO_CREDENTIALS } from "../env.js";
import { ensureAuthenticated } from "../helpers/navigation.js";

type AuthenticatedFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page }, use) => {
    test.skip(!hasPrimaryCredentials(), SKIP_NO_CREDENTIALS);
    const credentials = getPrimaryCredentials();
    await ensureAuthenticated(page, credentials);
    await use(page);
  },
});

export { expect };

export function skipWithoutCredentials(): void {
  test.skip(!hasPrimaryCredentials(), SKIP_NO_CREDENTIALS);
}
