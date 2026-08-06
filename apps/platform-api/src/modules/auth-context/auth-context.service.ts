import { Inject, Injectable } from "@nestjs/common";
import { verifyCognitoAccessToken } from "@forge/auth";
import { evaluateTenantOperationalState } from "@forge/authorization";
import { SUBSCRIPTION_STATUSES } from "@forge/contracts";
import {
  lookupIdentity,
  lookupUserTenants,
  membershipModuleAccess,
  membershipProductAccess,
  membershipRoleAssignments,
  organizationMemberships,
  permissions,
  platformModules,
  platformProducts,
  rolePermissions,
  roles,
  subscriptions,
  tenantModuleEntitlements,
  tenantProducts,
  tenants,
  userRoleAssignments,
  users,
  userTenantAccess,
  userTenantMemberships,
  withTenantTransaction,
  type Database,
} from "@forge/database";
import type { ForgeEnvironment } from "@forge/environment";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal, TenantOperationalState } from "@forge/tenant-context";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { APP_ENV, DATABASE } from "../../tokens.js";
import type { RequestWithIds } from "../../common/request-ids.js";
import { getRequestIds } from "../../common/request-ids.js";
import { CognitoAdminService } from "../cognito/cognito-admin.service.js";

const PLATFORM_SUPER_ADMIN = "PLATFORM_SUPER_ADMIN";

@Injectable()
export class AuthContextService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_ENV) private readonly env: ForgeEnvironment,
    private readonly cognito: CognitoAdminService,
  ) {}

  async resolvePrincipal(req: RequestWithIds): Promise<ForgePrincipal> {
    const ids = getRequestIds(req);
    const authHeader = req.header("authorization");
    const bearer =
      authHeader?.startsWith("Bearer ") || authHeader?.startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : null;

    let userId: string | null = null;
    let tenantHint: string | null = null;
    let identityId: string | null = null;
    let authProvider: ForgePrincipal["authProvider"] = "COGNITO";
    let tokenIssuedAtMs: number | null = null;

    if (bearer) {
      const claims = await verifyCognitoAccessToken(bearer, {
        region: this.env.AWS_REGION,
        userPoolId: this.env.COGNITO_USER_POOL_ID,
        clientId: this.env.COGNITO_CLIENT_ID,
      }).catch(() => {
        throw new ForgeError("UNAUTHORIZED", "Invalid or expired access token");
      });

      const identity = await lookupIdentity(this.db, "COGNITO", claims.sub);
      if (!identity) {
        throw new ForgeError("UNAUTHORIZED", "Authentication identity is not linked");
      }
      if (identity.userStatus === "DISABLED") {
        throw new ForgeError("FORBIDDEN", "User account is disabled");
      }
      if (
        identity.sessionsRevokedAt &&
        typeof claims.iat === "number" &&
        claims.iat * 1000 < identity.sessionsRevokedAt.getTime()
      ) {
        throw new ForgeError("UNAUTHORIZED", "Session has been revoked");
      }

      identityId = identity.identityId;
      userId = identity.userId;
      tenantHint = identity.tenantId;
      tokenIssuedAtMs = typeof claims.iat === "number" ? claims.iat * 1000 : null;
    } else if (
      this.env.APP_ENV === "local" ||
      this.env.APP_ENV === "development" ||
      this.env.APP_ENV === "testing"
    ) {
      const raw =
        req.header("x-forge-dev-principal") ??
        req.header("x-forge-dev-user") ??
        req.header("X-Forge-Dev-User");
      if (!raw) {
        throw new ForgeError("UNAUTHORIZED", "Missing Authorization or dev principal header");
      }
      let parsed: { userId?: string; tenantId?: string };
      try {
        parsed = JSON.parse(raw) as { userId?: string; tenantId?: string };
      } catch {
        throw new ForgeError("UNAUTHORIZED", "Invalid x-forge-dev-principal JSON");
      }
      if (!parsed.userId || !parsed.tenantId) {
        throw new ForgeError("UNAUTHORIZED", "Dev principal requires userId and tenantId");
      }
      userId = parsed.userId;
      tenantHint = parsed.tenantId;
      identityId = `dev:${parsed.userId}`;
      authProvider = "COGNITO";
    } else {
      throw new ForgeError("UNAUTHORIZED", "Authorization Bearer token required");
    }

    const user = await withTenantTransaction(this.db, tenantHint!, async (tx) =>
      tx.query.users.findFirst({ where: eq(users.id, userId!) }),
    );
    if (!user) {
      throw new ForgeError("UNAUTHORIZED", "User not found");
    }
    if (user.status === "DISABLED") {
      throw new ForgeError("FORBIDDEN", "User account is disabled");
    }
    if (
      user.sessionsRevokedAt &&
      tokenIssuedAtMs !== null &&
      tokenIssuedAtMs < user.sessionsRevokedAt.getTime()
    ) {
      throw new ForgeError("UNAUTHORIZED", "Session has been revoked");
    }

    const routeTenantId =
      (req.params?.tenantId as string | undefined) ??
      req.header("x-tenant-id")?.trim() ??
      tenantHint;

    if (!routeTenantId) {
      throw new ForgeError("BAD_REQUEST", "Tenant context could not be resolved");
    }

    const access = await this.resolveTenantAccess(userId!, routeTenantId);

    const homeTenantId = access?.tenantId ?? user.tenantId;
    const permissionBundle = await this.loadPermissions(homeTenantId, userId!);
    const isSuper =
      permissionBundle.roleCodes.has(PLATFORM_SUPER_ADMIN) ||
      (permissionBundle.permissionCodes.has("platform.tenant.create") &&
        permissionBundle.permissionCodes.has("platform.tenant.suspend") &&
        permissionBundle.permissionCodes.has("platform.entitlement.manage"));

    if (!access && !isSuper) {
      throw new ForgeError("FORBIDDEN", "No active access to the requested tenant");
    }
    if (access && access.status !== "ACTIVE" && !isSuper) {
      throw new ForgeError("FORBIDDEN", "Membership is not active for the requested tenant");
    }

    const tenantId = routeTenantId;
    const tenant = await withTenantTransaction(this.db, tenantId, async (tx) =>
      tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }),
    );
    if (!tenant && !isSuper) {
      throw new ForgeError("NOT_FOUND", "Tenant not found");
    }

    let effectivePermissions = permissionBundle;
    if (access && homeTenantId !== tenantId && !isSuper) {
      effectivePermissions = await this.loadPermissions(tenantId, userId!);
    }

    const entitlements = tenant
      ? await this.loadEntitlements(tenantId, access?.membershipId ?? null)
      : { products: new Set<string>(), modules: new Set<string>() };

    const memberships = user.personId
      ? await withTenantTransaction(this.db, tenantId, async (tx) =>
          tx.query.organizationMemberships.findMany({
            where: and(
              eq(organizationMemberships.tenantId, tenantId),
              eq(organizationMemberships.personId, user.personId!),
              eq(organizationMemberships.status, "ACTIVE"),
            ),
          }),
        )
      : [];

    return {
      authenticationIdentityId: identityId!,
      userId: userId!,
      personId: user.personId,
      tenantId,
      organizationIds: memberships.map((m) => m.organizationId),
      permissions: effectivePermissions.permissionCodes,
      activeProducts: entitlements.products,
      activeModules: entitlements.modules,
      correlationId: ids.correlationId,
      requestId: ids.requestId,
      authProvider,
      isPlatformAdmin: isSuper,
    };
  }

  async listAvailableTenants(userId: string) {
    let rows: Awaited<ReturnType<typeof lookupUserTenants>>;
    try {
      rows = await lookupUserTenants(this.db, userId);
    } catch (error: unknown) {
      throw new ForgeError(
        "INTERNAL_ERROR",
        "Failed to resolve available tenants for the authenticated user",
        {
          exposeMessage: this.env.APP_ENV === "local" || this.env.APP_ENV === "development",
          cause: error,
          details: [
            {
              reason: error instanceof Error ? error.message : String(error),
            },
          ],
        },
      );
    }
    return rows.map((row) => ({
      tenantId: row.tenantId,
      slug: row.tenantSlug,
      displayName: row.tenantDisplayName,
      tenantStatus: row.tenantStatus,
      membershipId: row.membershipId,
      membershipStatus: row.membershipStatus,
      isDefaultTenant: row.isDefaultTenant,
      selectable: row.membershipStatus === "ACTIVE" && row.tenantStatus === "ACTIVE",
    }));
  }

  async selectTenant(
    principal: ForgePrincipal,
    tenantId: string,
  ): Promise<ReturnType<AuthContextService["toClientSummary"]>> {
    const access = await this.resolveTenantAccess(principal.userId, tenantId);
    if (!access || access.status !== "ACTIVE") {
      if (!principal.isPlatformAdmin) {
        throw new ForgeError("FORBIDDEN", "No active membership for the selected tenant");
      }
    }

    const tenant = await withTenantTransaction(this.db, tenantId, async (tx) =>
      tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }),
    );
    if (!tenant) {
      throw new ForgeError("NOT_FOUND", "Tenant not found");
    }
    if (tenant.status !== "ACTIVE" && !principal.isPlatformAdmin) {
      throw new ForgeError("TENANT_INACTIVE", "Selected tenant is not active");
    }

    const permissions = await this.loadPermissions(tenantId, principal.userId);
    const entitlements = await this.loadEntitlements(tenantId, access?.membershipId ?? null);
    const summaryPrincipal: ForgePrincipal = {
      ...principal,
      tenantId,
      permissions: permissions.permissionCodes,
      activeProducts: entitlements.products,
      activeModules: entitlements.modules,
    };
    return this.toClientSummary(summaryPrincipal);
  }

  /**
   * Invalidates every issued access token for the principal by stamping
   * sessions_revoked_at and bumping session_version, then asking Cognito to
   * drop refresh tokens.
   */
  async logoutAll(principal: ForgePrincipal): Promise<{ sessionVersion: number }> {
    const now = new Date();
    const updated = await withTenantTransaction(
      this.db,
      principal.tenantId,
      async (tx) => {
        const current = await tx.query.users.findFirst({ where: eq(users.id, principal.userId) });
        if (!current) {
          throw new ForgeError("NOT_FOUND", "User not found");
        }
        const [row] = await tx
          .update(users)
          .set({
            sessionsRevokedAt: now,
            sessionVersion: current.sessionVersion + 1,
            updatedAt: now,
          })
          .where(eq(users.id, principal.userId))
          .returning({
            sessionVersion: users.sessionVersion,
            primaryEmail: users.primaryEmail,
          });
        return row;
      },
      principal.userId,
    );

    if (this.cognito.enabled && updated?.primaryEmail) {
      await this.cognito.globalSignOut(updated.primaryEmail).catch(() => undefined);
    }

    return { sessionVersion: updated?.sessionVersion ?? 1 };
  }

  async getTenantOperationalState(tenantId: string): Promise<TenantOperationalState> {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const tenant = await tx.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });
      if (!tenant) {
        return evaluateTenantOperationalState({
          tenantStatus: "ARCHIVED",
          subscriptionStatus: null,
        });
      }
      const current = await tx.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.tenantId, tenantId),
          inArray(subscriptions.status, [...SUBSCRIPTION_STATUSES, "TRIAL", "GRACE", "CANCELED"]),
        ),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
      return evaluateTenantOperationalState({
        tenantStatus: tenant.status,
        subscriptionStatus: current?.status ?? null,
      });
    });
  }

  private async resolveTenantAccess(userId: string, tenantId: string) {
    const membership = await withTenantTransaction(this.db, tenantId, async (tx) =>
      tx.query.userTenantMemberships.findFirst({
        where: and(
          eq(userTenantMemberships.userId, userId),
          eq(userTenantMemberships.tenantId, tenantId),
        ),
      }),
    );
    if (membership) {
      return {
        tenantId: membership.tenantId,
        status: membership.status,
        membershipId: membership.id,
      };
    }

    // Compatibility projection for rows not yet migrated to memberships.
    const access = await withTenantTransaction(this.db, tenantId, async (tx) =>
      tx.query.userTenantAccess.findFirst({
        where: and(eq(userTenantAccess.userId, userId), eq(userTenantAccess.tenantId, tenantId)),
      }),
    );
    return access
      ? { tenantId: access.tenantId, status: access.status, membershipId: null as string | null }
      : null;
  }

  private async loadPermissions(tenantId: string, userId: string) {
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const membership = await tx.query.userTenantMemberships.findFirst({
          where: and(
            eq(userTenantMemberships.tenantId, tenantId),
            eq(userTenantMemberships.userId, userId),
            eq(userTenantMemberships.status, "ACTIVE"),
          ),
        });

        let roleRows: Array<{ roleId: string; roleCode: string }> = [];
        if (membership) {
          roleRows = await tx
            .select({
              roleId: membershipRoleAssignments.roleId,
              roleCode: roles.code,
            })
            .from(membershipRoleAssignments)
            .innerJoin(roles, eq(roles.id, membershipRoleAssignments.roleId))
            .where(
              and(
                eq(membershipRoleAssignments.membershipId, membership.id),
                eq(membershipRoleAssignments.status, "ACTIVE"),
                isNull(membershipRoleAssignments.revokedAt),
              ),
            );
        } else {
          // Fall back to the Sprint 1D user_role_assignments projection.
          roleRows = await tx
            .select({
              roleId: userRoleAssignments.roleId,
              roleCode: roles.code,
            })
            .from(userRoleAssignments)
            .innerJoin(roles, eq(roles.id, userRoleAssignments.roleId))
            .where(
              and(
                eq(userRoleAssignments.tenantId, tenantId),
                eq(userRoleAssignments.userId, userId),
                isNull(userRoleAssignments.revokedAt),
              ),
            );
        }

        const roleCodes = new Set(roleRows.map((a) => a.roleCode));
        const roleIds = roleRows.map((a) => a.roleId);
        const permissionCodes = new Set<string>();

        if (roleIds.length > 0) {
          const perms = await tx
            .select({
              code: permissions.code,
              effect: rolePermissions.effect,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(inArray(rolePermissions.roleId, roleIds));

          for (const p of perms) {
            if (p.effect !== "DENY") {
              permissionCodes.add(p.code);
            }
          }
        }

        return { roleCodes, permissionCodes };
      },
      userId,
    );
  }

  private async loadEntitlements(tenantId: string, membershipId: string | null) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const products = new Set<string>();
      const modules = new Set<string>();

      if (membershipId) {
        const mp = await tx
          .select({ code: platformProducts.code })
          .from(membershipProductAccess)
          .innerJoin(platformProducts, eq(platformProducts.id, membershipProductAccess.productId))
          .where(
            and(
              eq(membershipProductAccess.membershipId, membershipId),
              eq(membershipProductAccess.status, "ACTIVE"),
            ),
          );
        for (const row of mp) {
          products.add(row.code);
        }

        const mm = await tx
          .select({ code: platformModules.code })
          .from(membershipModuleAccess)
          .innerJoin(platformModules, eq(platformModules.id, membershipModuleAccess.moduleId))
          .where(
            and(
              eq(membershipModuleAccess.membershipId, membershipId),
              eq(membershipModuleAccess.status, "ACTIVE"),
            ),
          );
        for (const row of mm) {
          modules.add(row.code);
        }

        // Membership grants are intersected with what the tenant itself holds.
        const tenantProductsSet = new Set<string>();
        const tp = await tx
          .select({ code: platformProducts.code })
          .from(tenantProducts)
          .innerJoin(platformProducts, eq(platformProducts.id, tenantProducts.productId))
          .where(and(eq(tenantProducts.tenantId, tenantId), eq(tenantProducts.status, "ACTIVE")));
        for (const row of tp) {
          tenantProductsSet.add(row.code);
        }
        for (const code of [...products]) {
          if (!tenantProductsSet.has(code)) {
            products.delete(code);
          }
        }

        const tenantModulesSet = new Set<string>();
        const tm = await tx
          .select({ code: platformModules.code })
          .from(tenantModuleEntitlements)
          .innerJoin(platformModules, eq(platformModules.id, tenantModuleEntitlements.moduleId))
          .where(
            and(
              eq(tenantModuleEntitlements.tenantId, tenantId),
              inArray(tenantModuleEntitlements.status, ["ACTIVE", "GRACE"]),
            ),
          );
        for (const row of tm) {
          tenantModulesSet.add(row.code);
        }
        for (const code of [...modules]) {
          if (!tenantModulesSet.has(code)) {
            modules.delete(code);
          }
        }

        return { products, modules };
      }

      const tp = await tx
        .select({ code: platformProducts.code })
        .from(tenantProducts)
        .innerJoin(platformProducts, eq(platformProducts.id, tenantProducts.productId))
        .where(and(eq(tenantProducts.tenantId, tenantId), eq(tenantProducts.status, "ACTIVE")));
      for (const row of tp) {
        products.add(row.code);
      }

      const tm = await tx
        .select({ code: platformModules.code })
        .from(tenantModuleEntitlements)
        .innerJoin(platformModules, eq(platformModules.id, tenantModuleEntitlements.moduleId))
        .where(
          and(
            eq(tenantModuleEntitlements.tenantId, tenantId),
            inArray(tenantModuleEntitlements.status, ["ACTIVE", "GRACE"]),
          ),
        );
      for (const row of tm) {
        modules.add(row.code);
      }

      return { products, modules };
    });
  }

  toClientSummary(principal: ForgePrincipal) {
    return {
      userId: principal.userId,
      personId: principal.personId,
      tenantId: principal.tenantId,
      organizationIds: principal.organizationIds,
      permissions: [...principal.permissions],
      activeProducts: [...principal.activeProducts],
      activeModules: [...principal.activeModules],
      isPlatformAdmin: principal.isPlatformAdmin,
      authProvider: principal.authProvider,
    };
  }
}
