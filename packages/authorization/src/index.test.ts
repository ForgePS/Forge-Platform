import { describe, expect, it } from "vitest";
import {
  evaluateAuthorization,
  evaluateTenantOperationalState,
  resolveFeatureValue,
} from "./index.js";
import type { ForgePrincipal } from "@forge/tenant-context";

function principal(overrides: Partial<ForgePrincipal> = {}): ForgePrincipal {
  return {
    authenticationIdentityId: "a",
    userId: "u",
    personId: "p",
    tenantId: "tenant-a",
    organizationIds: [],
    permissions: new Set(["platform.person.read"]),
    activeProducts: new Set(["FORGE_ACADEMY"]),
    activeModules: new Set(["ACADEMY_CORE"]),
    correlationId: "c",
    requestId: "r",
    authProvider: "COGNITO",
    isPlatformAdmin: false,
    ...overrides,
  };
}

describe("evaluateAuthorization", () => {
  it("denies cross-tenant access", () => {
    const decision = evaluateAuthorization({
      principal: principal(),
      permissionCode: "platform.person.read",
      resourceType: "person",
      resourceTenantId: "tenant-b",
      tenantOperationalState: evaluateTenantOperationalState({
        tenantStatus: "ACTIVE",
        subscriptionStatus: "ACTIVE",
      }),
      roleEffects: [{ effect: "ALLOW", organizationId: null }],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("TENANT_MISMATCH");
  });

  it("applies explicit deny over allow", () => {
    const decision = evaluateAuthorization({
      principal: principal(),
      permissionCode: "platform.person.read",
      resourceType: "person",
      resourceTenantId: "tenant-a",
      tenantOperationalState: evaluateTenantOperationalState({
        tenantStatus: "ACTIVE",
        subscriptionStatus: "ACTIVE",
      }),
      roleEffects: [
        { effect: "ALLOW", organizationId: null },
        { effect: "DENY", organizationId: null },
      ],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("EXPLICIT_DENY");
  });

  it("denies writes when subscription inactive", () => {
    const decision = evaluateAuthorization({
      principal: principal(),
      permissionCode: "platform.person.create",
      resourceType: "person",
      resourceTenantId: "tenant-a",
      tenantOperationalState: evaluateTenantOperationalState({
        tenantStatus: "ACTIVE",
        subscriptionStatus: "SUSPENDED",
      }),
      roleEffects: [{ effect: "ALLOW", organizationId: null }],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("allows reads in READ_ONLY subscription mode", () => {
    const operational = evaluateTenantOperationalState({
      tenantStatus: "ACTIVE",
      subscriptionStatus: "READ_ONLY",
    });
    const readDecision = evaluateAuthorization({
      principal: principal({ permissions: new Set(["platform.person.read"]) }),
      permissionCode: "platform.person.read",
      resourceType: "person",
      resourceTenantId: "tenant-a",
      tenantOperationalState: operational,
      roleEffects: [{ effect: "ALLOW", organizationId: null }],
    });
    const writeDecision = evaluateAuthorization({
      principal: principal({ permissions: new Set(["platform.person.create"]) }),
      permissionCode: "platform.person.create",
      resourceType: "person",
      resourceTenantId: "tenant-a",
      tenantOperationalState: operational,
      roleEffects: [{ effect: "ALLOW", organizationId: null }],
    });
    expect(readDecision.allowed).toBe(true);
    expect(writeDecision.allowed).toBe(false);
  });

  it("treats PAYMENT_DUE and GRACE_PERIOD as writable", () => {
    for (const status of ["PAYMENT_DUE", "GRACE_PERIOD"] as const) {
      const operational = evaluateTenantOperationalState({
        tenantStatus: "ACTIVE",
        subscriptionStatus: status,
      });
      expect(operational.canUseProducts).toBe(true);
    }
  });
});

describe("evaluateTenantOperationalState", () => {
  it("blocks product use for TERMINATED subscriptions while keeping auth", () => {
    const state = evaluateTenantOperationalState({
      tenantStatus: "ACTIVE",
      subscriptionStatus: "TERMINATED",
    });
    expect(state.canAuthenticate).toBe(true);
    expect(state.canUseProducts).toBe(false);
  });

  it("treats TRIAL like an operational tenant when subscription is writable", () => {
    const state = evaluateTenantOperationalState({
      tenantStatus: "TRIAL",
      subscriptionStatus: "ACTIVE",
    });
    expect(state.canAuthenticate).toBe(true);
    expect(state.canUseProducts).toBe(true);
    expect(state.reasonCode).toBeNull();
  });

  it("treats CANCELED as inactive", () => {
    const state = evaluateTenantOperationalState({
      tenantStatus: "CANCELED",
      subscriptionStatus: "ACTIVE",
    });
    expect(state.canAuthenticate).toBe(false);
    expect(state.canUseProducts).toBe(false);
    expect(state.reasonCode).toBe("TENANT_INACTIVE");
  });
});

describe("resolveFeatureValue", () => {
  it("uses user override first", () => {
    expect(
      resolveFeatureValue({
        user: true,
        tenant: false,
        defaultValue: false,
      }),
    ).toBe(true);
  });
});
