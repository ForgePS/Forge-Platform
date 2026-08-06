import { expect, test, type Page } from "@playwright/test";

const CREATOR = (
  process.env.CREATOR_BASE_URL ?? "https://creator-dev.forgepublicsafety.com"
).replace(/\/$/, "");
const USERNAME = process.env.E2E_COGNITO_USERNAME?.trim() ?? "";
const PASSWORD = process.env.E2E_COGNITO_PASSWORD?.trim() ?? "";

const CORE_ROUTES = [
  "/",
  "/health/",
  "/deployment/",
  "/tenants/",
  "/organizations/",
  "/persons/",
  "/users/",
  "/roles/",
  "/permissions/",
  "/products/",
  "/entitlements/",
  "/subscriptions/",
  "/features/",
  "/invitations/",
  "/memberships/",
  "/onboarding/",
  "/studio/",
  "/studio/branding/",
  "/studio/terminology/",
  "/studio/dropdowns/",
  "/studio/navigation/",
  "/studio/roles/",
  "/imports/",
  "/branding/",
  "/configuration/",
  "/audit/",
] as const;

const EXTENDED_ROUTES = [
  "/migrations/",
  "/ai/",
  "/ai/providers/",
  "/ai/models/",
  "/ai/policies/",
  "/ai/usage/",
  "/ai/audit/",
  "/neris/packages/",
  "/neris/versions/",
  "/neris/modules/",
  "/neris/fields/",
] as const;

test.describe.configure({ mode: "serial" });

test.beforeEach(() => {
  test.skip(!USERNAME || !PASSWORD, "Set E2E_COGNITO_USERNAME and E2E_COGNITO_PASSWORD");
});

async function loginViaCognito(page: Page): Promise<void> {
  await page.goto(`${CREATOR}/login/`);
  await expect(page.getByRole("heading", { name: /forge creator console/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Missing Cognito OAuth configuration/i);

  await page.getByRole("button", { name: /^sign in$/i }).click();

  await page.waitForURL(
    (url) =>
      /amazoncognito\.com|\/oauth2\//.test(url.href) ||
      (url.origin === CREATOR &&
        (/\/auth\/callback\/?/.test(url.pathname) ||
          /\/select-tenant\/?/.test(url.pathname) ||
          url.pathname === "/" ||
          url.pathname.endsWith("/index.html"))),
    { timeout: 60_000 },
  );

  if (/amazoncognito\.com|\/oauth2\//.test(page.url())) {
    const usernameField = page.locator('input[name="username"]:visible').first();
    const passwordField = page.locator('input[name="password"]:visible').first();
    await usernameField.waitFor({ state: "visible", timeout: 30_000 });
    await usernameField.fill(USERNAME);
    await passwordField.fill(PASSWORD);
    await page
      .locator(
        'input[name="signInSubmitButton"]:visible, button[type="submit"]:visible, input[type="submit"]:visible',
      )
      .first()
      .click();

    await page.waitForURL(
      (url) =>
        url.origin === CREATOR &&
        (/\/auth\/callback\/?/.test(url.pathname) ||
          /\/select-tenant\/?/.test(url.pathname) ||
          url.pathname === "/" ||
          url.pathname.endsWith("/index.html")),
      { timeout: 60_000 },
    );
  }

  if (page.url().includes("/auth/callback")) {
    await page.waitForURL(
      (url) =>
        /\/select-tenant\/?/.test(url.pathname) ||
        url.pathname === "/" ||
        url.pathname.endsWith("/index.html"),
      { timeout: 60_000 },
    );
  }

  if (page.url().includes("/select-tenant")) {
    await page.getByRole("heading", { name: /select tenant/i }).waitFor({ timeout: 20_000 });
    const forgePlatform = page.getByRole("button", { name: /^select$/i }).first();
    // Prefer Forge Platform if listed as text near a Select button.
    const platformRow = page.locator("tr, li, div").filter({ hasText: /forge platform/i }).first();
    if (await platformRow.count()) {
      const rowSelect = platformRow.getByRole("button", { name: /^select$/i }).first();
      if (await rowSelect.count()) {
        await rowSelect.click();
      } else {
        await forgePlatform.click();
      }
    } else {
      await forgePlatform.click();
    }
    await page.waitForURL(
      (url) => !url.pathname.includes("/select-tenant") && !url.pathname.includes("/login"),
      { timeout: 30_000 },
    );
  }
}

async function assertOperationalPage(page: Page, route: string): Promise<string[]> {
  const problems: string[] = [];
  const response = await page.goto(`${CREATOR}${route}`, { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 400) {
    problems.push(`${route}: HTTP ${response?.status() ?? "no-response"}`);
  }

  await expect(page.locator("body")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();

  if (body.includes("missing cognito oauth configuration")) {
    problems.push(`${route}: Cognito config missing`);
  }
  if (body.includes("cannot get")) {
    problems.push(`${route}: Cannot GET`);
  }
  if (body.includes("lorem ipsum")) {
    problems.push(`${route}: placeholder lorem`);
  }
  // Auth/bootstrap failures
  if (
    body.includes("authentication failed") ||
    body.includes("unauthorized") ||
    body.includes("failed to load") ||
    body.includes("request failed: 5")
  ) {
    problems.push(`${route}: auth/API failure text present`);
  }
  if (body.includes("wave 5") && body.includes("not available")) {
    problems.push(`${route}: outdated Wave 5 onboarding stub message`);
  }

  // Hard crash overlays
  const oops = page.getByText(/application error|uncaught|something went wrong/i);
  if (await oops.count()) {
    problems.push(`${route}: app error UI`);
  }

  return problems;
}

test("Creator Console Cognito login reaches authenticated shell @smoke", async ({ page }) => {
  await loginViaCognito(page);
  await expect(page.locator("body")).toContainText(/creator|forge|dashboard|platform/i, {
    timeout: 20_000,
  });
  await expect(page.locator("body")).not.toContainText(/Missing Cognito OAuth configuration/i);
  // Signed-in chrome or dashboard content should appear.
  await expect(
    page.getByRole("link", { name: /tenants|health|studio|dashboard/i }).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test("core admin routes load without hard failures @smoke", async ({ page }) => {
  await loginViaCognito(page);
  const allProblems: string[] = [];

  for (const route of CORE_ROUTES) {
    allProblems.push(...(await assertOperationalPage(page, route)));
  }

  expect(allProblems, allProblems.join("\n")).toEqual([]);
});

test("extended surfaces load (AI / NERIS / migrations) @smoke", async ({ page }) => {
  await loginViaCognito(page);
  const allProblems: string[] = [];

  for (const route of EXTENDED_ROUTES) {
    allProblems.push(...(await assertOperationalPage(page, route)));
  }

  expect(allProblems, allProblems.join("\n")).toEqual([]);
});

test("tenants list and studio branding respond with live data chrome @smoke", async ({ page }) => {
  await loginViaCognito(page);

  await page.goto(`${CREATOR}/tenants/`);
  await expect(page.getByRole("heading", { name: "Tenants", exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("body")).not.toContainText(/failed to load tenants/i);

  await page.goto(`${CREATOR}/studio/`);
  await expect(page.locator("body")).toContainText(/studio|configuration|module/i, {
    timeout: 20_000,
  });

  // Branding studio needs a tenant query — pick from tenants page if possible.
  await page.goto(`${CREATOR}/tenants/`);
  const tenantLink = page.locator('a[href*="tenantId="]').first();
  if (await tenantLink.count()) {
    const href = await tenantLink.getAttribute("href");
    const match = href?.match(/tenantId=([^&]+)/);
    const tenantId = match?.[1];
    if (tenantId) {
      await page.goto(`${CREATOR}/studio/branding/?tenantId=${tenantId}`);
      await expect(page.locator("body")).toContainText(/branding|payload|version|draft|publish/i, {
        timeout: 30_000,
      });
    }
  }
});

test("roles page exposes create + permissions authoring @smoke", async ({ page }) => {
  await loginViaCognito(page);
  await page.goto(`${CREATOR}/roles/`);
  await expect(page.getByRole("heading", { name: "Roles", exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: /create role/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /role permissions/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /assign role to user/i })).toBeVisible();
});

test("onboarding page is wired to platform sessions API @smoke", async ({ page }) => {
  await loginViaCognito(page);
  await page.goto(`${CREATOR}/onboarding/`);
  await expect(page.getByRole("heading", { name: /onboarding/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("body")).toContainText(/platform\/onboarding\/sessions/i);
  await expect(page.locator("body")).not.toContainText(/wave 5/i);
  await expect(page.getByRole("button", { name: /start onboarding/i })).toBeVisible();
});
