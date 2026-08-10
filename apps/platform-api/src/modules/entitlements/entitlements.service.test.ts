import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { EntitlementsService } from "./entitlements.service.js";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MODULE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function principal(): ForgePrincipal {
  return {
    authenticationIdentityId: "aid",
    userId: "11111111-1111-4111-8111-111111111111",
    personId: null,
    tenantId: TENANT_ID,
    organizationIds: [],
    permissions: new Set(["platform.entitlement.manage"]),
    activeProducts: new Set(),
    activeModules: new Set(),
    correlationId: "corr-1",
    requestId: "req-1",
    authProvider: "COGNITO",
    isPlatformAdmin: true,
  };
}

function createMocks() {
  const outboxTypes: string[] = [];
  const auditActions: string[] = [];
  let productRow: Record<string, unknown> | null = null;
  let moduleRow: Record<string, unknown> | null = null;

  const tx = {
    execute: vi.fn(async () => undefined),
    insert: vi.fn((table: { [key: symbol]: unknown } | object) => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          if (!productRow && values.productId) {
            productRow = { id: "tp-1", ...values };
            return [productRow];
          }
          moduleRow = { id: "tm-1", ...values };
          return [moduleRow];
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (productRow) {
              productRow = { ...productRow, ...values };
              return [productRow];
            }
            moduleRow = { ...(moduleRow ?? {}), ...values };
            return [moduleRow];
          }),
        })),
      })),
    })),
    query: {
      platformProducts: {
        findFirst: vi.fn(async () => ({
          id: PRODUCT_ID,
          code: "FORGE_INDUSTRIAL",
          name: "Forge Industrial",
        })),
      },
      platformModules: {
        findFirst: vi.fn(async () => ({
          id: MODULE_ID,
          code: "LOTO",
          name: "Lockout Tagout",
        })),
      },
      tenantProducts: {
        findFirst: vi.fn(async () => productRow),
      },
      tenantModuleEntitlements: {
        findFirst: vi.fn(async () => moduleRow),
      },
    },
  };

  const db = {
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const outbox = {
    write: vi.fn(async (_t: unknown, input: { eventType: string }) => {
      outboxTypes.push(input.eventType);
      return "outbox-1";
    }),
  };
  const audit = {
    writeInTransaction: vi.fn(async (_t: unknown, input: { action: string }) => {
      auditActions.push(input.action);
      return "audit-1";
    }),
  };

  return {
    service: new EntitlementsService(db as never, outbox as never, audit as never),
    outboxTypes,
    auditActions,
    getProductRow: () => productRow,
    getModuleRow: () => moduleRow,
  };
}

describe("EntitlementsService assignments", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it("assigns a product to a tenant", async () => {
    const row = await mocks.service.putProduct(
      TENANT_ID,
      "FORGE_INDUSTRIAL",
      { status: "ACTIVE" },
      principal(),
    );
    expect(row.tenantId).toBe(TENANT_ID);
    expect(row.productId).toBe(PRODUCT_ID);
    expect(row.status).toBe("ACTIVE");
    expect(mocks.outboxTypes).toContain(DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED);
    expect(mocks.auditActions).toContain("entitlement.product.put");
  });

  it("assigns a module entitlement to a tenant", async () => {
    const row = await mocks.service.putModule(
      TENANT_ID,
      "LOTO",
      { status: "ACTIVE" },
      principal(),
    );
    expect(row.tenantId).toBe(TENANT_ID);
    expect(row.moduleId).toBe(MODULE_ID);
    expect(row.status).toBe("ACTIVE");
    expect(mocks.outboxTypes).toContain(DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED);
  });
});
