import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const CREATOR = (
  process.env.CREATOR_BASE_URL ?? "https://creator-dev.forgepublicsafety.com"
).replace(/\/$/, "");
const USERNAME = process.env.E2E_COGNITO_USERNAME?.trim() ?? "";
const PASSWORD = process.env.E2E_COGNITO_PASSWORD?.trim() ?? "";

test.beforeEach(() => {
  test.skip(!USERNAME || !PASSWORD, "Set E2E_COGNITO_USERNAME and E2E_COGNITO_PASSWORD");
});

test("Wave C Creator a11y smoke on priority routes", async ({ page }) => {
  await page.goto(`${CREATOR}/login/`);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(
    (url) =>
      /amazoncognito\.com|\/oauth2\//.test(url.href) ||
      (url.origin === CREATOR && !/\/login\/?$/.test(url.pathname)),
    { timeout: 60_000 },
  );
  if (/amazoncognito\.com|\/oauth2\//.test(page.url())) {
    await page.locator('input[name="username"]:visible').first().fill(USERNAME);
    await page.locator('input[name="password"]:visible').first().fill(PASSWORD);
    await page.locator('button[type="submit"]:visible').first().click();
    await page.waitForURL(
      (url) => url.origin === CREATOR && !/amazoncognito\.com/.test(url.href),
      { timeout: 90_000 },
    );
  }

  for (const path of ["/", "/tenants/", "/migrations/", "/support/", "/billing/", "/health/"] as const) {
    await page.goto(`${CREATOR}${path}`);
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  }
});
