import { expect, test, type Page } from "@playwright/test";

const CREATOR = (
  process.env.CREATOR_BASE_URL ?? "https://creator-dev.forgepublicsafety.com"
).replace(/\/$/, "");
const INDUSTRIAL = (
  process.env.INDUSTRIAL_BASE_URL ?? "https://industrial-dev.forgepublicsafety.com"
).replace(/\/$/, "");
const USERNAME = process.env.E2E_COGNITO_USERNAME?.trim() ?? "";
const PASSWORD = process.env.E2E_COGNITO_PASSWORD?.trim() ?? "";
const UPDATE = process.env.PW_UPDATE_SNAPSHOTS === "1";

test.describe.configure({ mode: "serial" });

test.beforeEach(() => {
  test.skip(!USERNAME || !PASSWORD, "Set E2E_COGNITO_USERNAME and E2E_COGNITO_PASSWORD");
});

async function loginCreator(page: Page): Promise<void> {
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
  if (/\/select-tenant\/?/.test(page.url())) {
    const first = page.getByRole("button").first();
    if (await first.isVisible().catch(() => false)) await first.click();
  }
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function shot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    maxDiffPixelRatio: 0.05,
    animations: "disabled",
  });
}

const CREATOR_DESKTOP = [
  { path: "/", name: "creator-dashboard" },
  { path: "/tenants/", name: "creator-customers" },
  { path: "/entitlements/", name: "creator-products-modules" },
  { path: "/products/", name: "creator-module-catalog" },
  { path: "/migrations/", name: "creator-migration-center" },
  { path: "/migrations/reconciliation/?id=mig_demo_producers_phase2", name: "creator-reconciliation" },
  { path: "/migrations/launch/?id=mig_demo_producers_phase2", name: "creator-launch-customer" },
  { path: "/support/", name: "creator-support" },
  { path: "/billing/", name: "creator-billing" },
  { path: "/health/", name: "creator-health" },
] as const;

test.describe("Wave C Creator visual regression (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("login and capture priority routes", async ({ page }) => {
    test.skip(!UPDATE, "Set PW_UPDATE_SNAPSHOTS=1 to write/compare screenshot baselines");
    await loginCreator(page);
    for (const route of CREATOR_DESKTOP) {
      await page.goto(`${CREATOR}${route.path}`);
      await page.waitForTimeout(800);
      await assertNoHorizontalOverflow(page);
      await shot(page, `desktop-${route.name}`);
    }
  });
});

test.describe("Wave C Creator visual regression (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile priority routes", async ({ page }) => {
    test.skip(!UPDATE, "Set PW_UPDATE_SNAPSHOTS=1 to write/compare screenshot baselines");
    await loginCreator(page);
    for (const route of [
      { path: "/", name: "creator-dashboard" },
      { path: "/tenants/", name: "creator-customers" },
      { path: "/entitlements/", name: "creator-products-modules" },
      { path: "/migrations/", name: "creator-migration-center" },
    ] as const) {
      await page.goto(`${CREATOR}${route.path}`);
      await page.waitForTimeout(800);
      await assertNoHorizontalOverflow(page);
      await shot(page, `mobile-${route.name}`);
    }
  });
});

test.describe("Wave C Industrial visual regression", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("industrial desktop modules", async ({ page }) => {
    test.skip(!UPDATE, "Set PW_UPDATE_SNAPSHOTS=1 to write/compare screenshot baselines");
    await page.goto(`${INDUSTRIAL}/`);
    // Industrial may redirect to login — reuse Cognito if presented
    if (await page.getByRole("button", { name: /^sign in$/i }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.waitForTimeout(1000);
      if (/amazoncognito\.com|\/oauth2\//.test(page.url())) {
        await page.locator('input[name="username"]:visible').first().fill(USERNAME);
        await page.locator('input[name="password"]:visible').first().fill(PASSWORD);
        await page.locator('button[type="submit"]:visible').first().click();
        await page.waitForURL((url) => url.origin === INDUSTRIAL, { timeout: 90_000 });
      }
    }
    for (const route of [
      { path: "/", name: "industrial-dashboard" },
      { path: "/modules/personnel/", name: "industrial-personnel" },
      { path: "/modules/incidents/", name: "industrial-incidents" },
      { path: "/modules/inspections/", name: "industrial-inspections" },
      { path: "/modules/loto/", name: "industrial-loto" },
      { path: "/modules/training/", name: "industrial-training" },
      { path: "/modules/forklifts/", name: "industrial-fleet" },
    ] as const) {
      await page.goto(`${INDUSTRIAL}${route.path}`);
      await page.waitForTimeout(800);
      await assertNoHorizontalOverflow(page);
      await shot(page, `desktop-${route.name}`);
    }
  });
});

test.describe("Wave C viewport overflow matrix", () => {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1600, height: 900 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
  ] as const;

  for (const vp of viewports) {
    test(`creator dashboard overflow ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await loginCreator(page);
      await page.goto(`${CREATOR}/`);
      await page.waitForTimeout(500);
      await assertNoHorizontalOverflow(page);
    });
  }
});
