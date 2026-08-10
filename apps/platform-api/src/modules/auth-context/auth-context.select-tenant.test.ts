import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContextService } from "./auth-context.service.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const withTenantTransaction = vi.fn();
const lookupUserTenants = vi.fn();

vi.mock("@forge/database", async () => {
  const actual = await vi.importActual<typeof import("@forge/database")>("@forge/database");
  return {
    ...actual,
    withTenantTransaction: (...args: unknown[]) => withTenantTransaction(...args),
    lookupUserTenants: (...args: unknown[]) => lookupUserTenants(...args),
  };
});

function principal(overrides?: Partial<{ isPlatformAdmin: boolean; tenantId: string }>) {
  return {
    authenticationIdentityId: "aid",
    userId: USER_ID,
    personId: null,
    tenantId: overrides?.tenantId ?? TENANT_A,
    organizationIds: [],
    permissions: new Set<string>(),
    activeProducts: new Set<string>(),
    activeModules: new Set<string>(),
    correlationId: "corr-1",
    requestId: "req-1",
    authProvider: "COGNITO" as const,
    isPlatformAdmin: overrides?.isPlatformAdmin ?? false,
  };
}

function createService() {
  const env = { APP_ENV: "testing" } as never;
  const cognito = { enabled: false, globalSignOut: vi.fn() };
  const db = {} as never;
  return new AuthContextService(db, env, cognito as never);
}

describe("AuthContextService selectTenant membership rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows switching when the user has an ACTIVE membership (single tenant)", async () => {
    withTenantTransaction.mockImplementation(async (_db, tenantId, fn) => {
      const tx = {
        query: {
          userTenantMemberships: {
            findFirst: vi.fn(async () =>
              tenantId === TENANT_A
                ? { id: "m1", tenantId: TENANT_A, userId: USER_ID, status: "ACTIVE" }
                : null,
            ),
          },
          userTenantAccess: { findFirst: vi.fn(async () => null) },
          tenants: {
            findFirst: vi.fn(async () => ({ id: TENANT_A, status: "ACTIVE" })),
          },
          userTenantMembershipsForPerms: undefined,
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(async () => []),
            })),
            where: vi.fn(async () => []),
          })),
        })),
      };
      // loadPermissions expects userTenantMemberships.findFirst again
      tx.query.userTenantMemberships.findFirst = vi.fn(async () => ({
        id: "m1",
        tenantId: TENANT_A,
        userId: USER_ID,
        status: "ACTIVE",
      }));
      return fn(tx);
    });

    const service = createService();
    const summary = await service.selectTenant(principal(), TENANT_A);
    expect(summary.tenantId).toBe(TENANT_A);
  });

  it("allows a user with multiple ACTIVE memberships to select either tenant", async () => {
    withTenantTransaction.mockImplementation(async (_db, tenantId, fn) => {
      const tx = {
        query: {
          userTenantMemberships: {
            findFirst: vi.fn(async () => ({
              id: `m-${tenantId}`,
              tenantId,
              userId: USER_ID,
              status: "ACTIVE",
            })),
          },
          userTenantAccess: { findFirst: vi.fn(async () => null) },
          tenants: {
            findFirst: vi.fn(async () => ({ id: tenantId, status: "ACTIVE" })),
          },
        },
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(async () => []),
            })),
            where: vi.fn(async () => []),
          })),
        })),
      };
      return fn(tx);
    });

    const service = createService();
    const a = await service.selectTenant(principal({ tenantId: TENANT_A }), TENANT_A);
    const b = await service.selectTenant(principal({ tenantId: TENANT_A }), TENANT_B);
    expect(a.tenantId).toBe(TENANT_A);
    expect(b.tenantId).toBe(TENANT_B);
  });

  it("rejects non-member tenant selection", async () => {
    withTenantTransaction.mockImplementation(async (_db, _tenantId, fn) => {
      const tx = {
        query: {
          userTenantMemberships: { findFirst: vi.fn(async () => null) },
          userTenantAccess: { findFirst: vi.fn(async () => null) },
          tenants: {
            findFirst: vi.fn(async () => ({ id: TENANT_B, status: "ACTIVE" })),
          },
        },
      };
      return fn(tx);
    });

    const service = createService();
    await expect(service.selectTenant(principal(), TENANT_B)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects inactive (SUSPENDED) membership selection", async () => {
    withTenantTransaction.mockImplementation(async (_db, _tenantId, fn) => {
      const tx = {
        query: {
          userTenantMemberships: {
            findFirst: vi.fn(async () => ({
              id: "m1",
              tenantId: TENANT_B,
              userId: USER_ID,
              status: "SUSPENDED",
            })),
          },
          userTenantAccess: { findFirst: vi.fn(async () => null) },
          tenants: {
            findFirst: vi.fn(async () => ({ id: TENANT_B, status: "ACTIVE" })),
          },
        },
      };
      return fn(tx);
    });

    const service = createService();
    await expect(service.selectTenant(principal(), TENANT_B)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects removed (REVOKED) membership selection", async () => {
    withTenantTransaction.mockImplementation(async (_db, _tenantId, fn) => {
      const tx = {
        query: {
          userTenantMemberships: {
            findFirst: vi.fn(async () => ({
              id: "m1",
              tenantId: TENANT_B,
              userId: USER_ID,
              status: "REVOKED",
            })),
          },
          userTenantAccess: { findFirst: vi.fn(async () => null) },
          tenants: {
            findFirst: vi.fn(async () => ({ id: TENANT_B, status: "ACTIVE" })),
          },
        },
      };
      return fn(tx);
    });

    const service = createService();
    await expect(service.selectTenant(principal(), TENANT_B)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists only ACTIVE memberships as selectable for multi-tenant users", async () => {
    lookupUserTenants.mockResolvedValue([
      {
        tenantId: TENANT_A,
        tenantSlug: "a",
        tenantDisplayName: "A",
        tenantStatus: "ACTIVE",
        membershipId: "m1",
        membershipStatus: "ACTIVE",
        isDefaultTenant: true,
      },
      {
        tenantId: TENANT_B,
        tenantSlug: "b",
        tenantDisplayName: "B",
        tenantStatus: "ACTIVE",
        membershipId: "m2",
        membershipStatus: "SUSPENDED",
        isDefaultTenant: false,
      },
    ]);

    const service = createService();
    const tenants = await service.listAvailableTenants(USER_ID);
    expect(tenants).toHaveLength(2);
    expect(tenants.find((t) => t.tenantId === TENANT_A)?.selectable).toBe(true);
    expect(tenants.find((t) => t.tenantId === TENANT_B)?.selectable).toBe(false);
  });
});
