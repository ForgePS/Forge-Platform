import { test, expect, skipWithoutCredentials } from "../src/fixtures/index.js";
import { getPrimaryCredentials } from "../src/env.js";
import { getBaseUrl } from "../src/env.js";
import { loginViaCognitoHostedUi, selectFirstTenant } from "../src/helpers/navigation.js";

test.describe("Cognito Hosted UI login @smoke", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("signs in and reaches tenant select or home", async ({ page }) => {
    const credentials = getPrimaryCredentials();
    const baseUrl = getBaseUrl();

    await page.goto(`${baseUrl}/login/`);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with cognito/i })).toBeVisible();

    await loginViaCognitoHostedUi(page, credentials);

    const onSelectTenant = page.url().includes("/select-tenant");
    const onHome = new URL(page.url()).pathname === "/" || page.url().endsWith("/index.html");

    if (onSelectTenant) {
      await expect(page.getByRole("heading", { name: /select tenant/i })).toBeVisible();
      await selectFirstTenant(page);
      await expect(page.getByRole("heading", { name: /records management/i })).toBeVisible();
    } else if (onHome) {
      await expect(page.getByRole("heading", { name: /records management/i })).toBeVisible();
    } else {
      throw new Error(`Unexpected post-login URL: ${page.url()}`);
    }
  });
});
