import { describe, expect, it } from "vitest";
import {
  assertTransition,
  comparePayloads,
  hashConfigPayload,
  resolveEffectiveVersion,
  resolveLoginBranding,
  validateConfigPayload,
} from "./index.js";

describe("@forge/configuration", () => {
  it("validates branding payload", () => {
    const parsed = validateConfigPayload("branding", {
      primaryColor: "#14532d",
      emailFromName: "Forge",
      productDisplayName: "Forge Industrial Safety",
      appShortName: "Bridge",
      logoUrl: "https://cdn.example.com/logo.svg",
    });
    expect(parsed).toMatchObject({
      primaryColor: "#14532d",
      productDisplayName: "Forge Industrial Safety",
      appShortName: "Bridge",
    });
  });

  it("validates nested login branding", () => {
    const parsed = validateConfigPayload("branding", {
      login: {
        brandLabel: "Producers",
        headline: "Welcome to Producers Rice Mill",
        body: "Sign in with your company account.",
        statusText: "Signed out",
        buttonLabel: "Continue",
        logoUrl: "https://cdn.example.com/login-logo.svg",
      },
    });
    expect(parsed).toMatchObject({
      login: {
        brandLabel: "Producers",
        headline: "Welcome to Producers Rice Mill",
        buttonLabel: "Continue",
      },
    });
  });

  it("resolves login branding with nested fields", () => {
    expect(
      resolveLoginBranding({
        loginShortName: "Legacy",
        productDisplayName: "Legacy Product",
        logoUrl: "https://cdn.example.com/sidebar.svg",
        login: {
          brandLabel: "Producers",
          headline: "Welcome to Producers",
          body: "Use SSO.",
          statusText: "Signed out",
          buttonLabel: "Continue",
          logoUrl: "https://cdn.example.com/login.svg",
        },
      }),
    ).toEqual({
      brandLabel: "Producers",
      headline: "Welcome to Producers",
      body: "Use SSO.",
      statusText: "Signed out",
      buttonLabel: "Continue",
      logoUrl: "https://cdn.example.com/login.svg",
    });
  });

  it("resolves login branding from legacy flat fields", () => {
    expect(
      resolveLoginBranding({
        loginShortName: "Industrial",
        productDisplayName: "Forge Industrial Safety",
        logoUrl: "https://cdn.example.com/logo.svg",
      }),
    ).toEqual({
      brandLabel: "Industrial",
      headline: "Welcome to Forge Industrial Safety",
      body: "Sign in is required to continue.",
      statusText: "Unauthenticated",
      buttonLabel: "Sign in",
      logoUrl: "https://cdn.example.com/logo.svg",
    });
  });

  it("hashes payloads stably", () => {
    expect(hashConfigPayload({ a: 1 })).toBe(hashConfigPayload({ a: 1 }));
  });

  it("enforces lifecycle transitions", () => {
    expect(() => assertTransition("DRAFT", "PUBLISHED")).not.toThrow();
    expect(() => assertTransition("PUBLISHED", "DRAFT")).toThrow();
  });

  it("compares payloads", () => {
    const diffs = comparePayloads({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(diffs).toEqual([{ path: "b", left: 2, right: 3 }]);
  });

  it("resolves effective published version", () => {
    const now = new Date("2026-07-28T12:00:00Z");
    const effective = resolveEffectiveVersion(
      [
        {
          state: "SUPERSEDED",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          effectiveTo: new Date("2026-06-01T00:00:00Z"),
          publishedAt: new Date("2026-01-01T00:00:00Z"),
          id: "old",
        },
        {
          state: "PUBLISHED",
          effectiveFrom: new Date("2026-06-01T00:00:00Z"),
          effectiveTo: null,
          publishedAt: new Date("2026-06-01T00:00:00Z"),
          id: "current",
        },
      ],
      now,
    );
    expect(effective?.id).toBe("current");
  });
});
