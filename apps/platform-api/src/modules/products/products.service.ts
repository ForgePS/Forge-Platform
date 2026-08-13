import { Inject, Injectable } from "@nestjs/common";
import {
  FORGE_PLATFORMS,
  catalogAvailabilityLabel,
  findCatalogModule,
  findPlatformByProductCode,
} from "@forge/contracts";
import {
  platformModules,
  platformProducts,
  subscriptionPlans,
  tenantModuleEntitlements,
  tenantProducts,
  type Database,
} from "@forge/database";
import { and, asc, count, eq } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

@Injectable()
export class ProductsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listProducts() {
    const rows = await this.db.query.platformProducts.findMany({
      where: eq(platformProducts.status, "ACTIVE"),
      orderBy: (t, { asc }) => [asc(t.code)],
    });
    return rows.map((row) => {
      const platform = findPlatformByProductCode(row.code);
      return {
        ...row,
        platformKey: platform?.key ?? null,
        customerAssignable: platform?.customerAssignable ?? row.code !== "FORGE_CREATOR",
        displayOrder: platform?.displayOrder ?? 100,
      };
    });
  }

  async listPlatforms() {
    const products = await this.listProducts();
    const moduleCounts = await this.db
      .select({
        productId: platformModules.productId,
        modules: count(platformModules.id),
      })
      .from(platformModules)
      .where(eq(platformModules.status, "ACTIVE"))
      .groupBy(platformModules.productId);

    const customerCounts = await this.db
      .select({
        productId: tenantProducts.productId,
        customers: count(tenantProducts.id),
      })
      .from(tenantProducts)
      .where(eq(tenantProducts.status, "ACTIVE"))
      .groupBy(tenantProducts.productId);

    const modulesByProduct = new Map(moduleCounts.map((r) => [r.productId, Number(r.modules)]));
    const customersByProduct = new Map(
      customerCounts.map((r) => [r.productId, Number(r.customers)]),
    );

    return FORGE_PLATFORMS.map((platform) => {
      const product = products.find((p) => p.code === platform.productCode);
      return {
        ...platform,
        productId: product?.id ?? null,
        moduleCount: product ? (modulesByProduct.get(product.id) ?? 0) : 0,
        customerCount: product ? (customersByProduct.get(product.id) ?? 0) : 0,
      };
    });
  }

  async listModules(productCode?: string) {
    const rows = await this.db
      .select({
        id: platformModules.id,
        code: platformModules.code,
        name: platformModules.name,
        description: platformModules.description,
        status: platformModules.status,
        isCore: platformModules.isCore,
        category: platformModules.category,
        classification: platformModules.classification,
        implementationStatus: platformModules.implementationStatus,
        customerAssignable: platformModules.customerAssignable,
        displayOrder: platformModules.displayOrder,
        productId: platformModules.productId,
        productCode: platformProducts.code,
        productName: platformProducts.name,
        createdAt: platformModules.createdAt,
        updatedAt: platformModules.updatedAt,
      })
      .from(platformModules)
      .innerJoin(platformProducts, eq(platformProducts.id, platformModules.productId))
      .where(
        productCode
          ? and(
              eq(platformModules.status, "ACTIVE"),
              eq(platformProducts.code, productCode),
            )
          : eq(platformModules.status, "ACTIVE"),
      )
      .orderBy(
        asc(platformProducts.code),
        asc(platformModules.displayOrder),
        asc(platformModules.name),
      );

    const assignmentCounts = await this.db
      .select({
        moduleId: tenantModuleEntitlements.moduleId,
        customers: count(tenantModuleEntitlements.id),
      })
      .from(tenantModuleEntitlements)
      .where(eq(tenantModuleEntitlements.status, "ACTIVE"))
      .groupBy(tenantModuleEntitlements.moduleId);
    const countByModule = new Map(
      assignmentCounts.map((r) => [r.moduleId, Number(r.customers)]),
    );

    return rows.map((row) => {
      const catalog = findCatalogModule(row.productCode, row.code);
      const platform = findPlatformByProductCode(row.productCode);
      const implementationStatus =
        catalog?.implementationStatus ?? row.implementationStatus ?? "READY";
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description ?? catalog?.description ?? null,
        status: row.status,
        isCore: row.isCore,
        category: catalog?.category ?? row.category ?? "General",
        classification: catalog?.classification ?? row.classification ?? "CUSTOMER_MODULE",
        implementationStatus,
        availabilityLabel: catalogAvailabilityLabel(implementationStatus),
        customerAssignable:
          catalog?.customerAssignable ??
          row.customerAssignable ??
          (!row.isCore && row.productCode !== "FORGE_CREATOR"),
        displayOrder: catalog?.displayOrder ?? row.displayOrder ?? 100,
        productId: row.productId,
        productCode: row.productCode,
        productName: row.productName,
        platformKey: platform?.key ?? null,
        customerAssignmentCount: countByModule.get(row.id) ?? 0,
        route: catalog?.route ?? null,
      };
    });
  }

  async listPlans() {
    return this.db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.status, "ACTIVE"),
      orderBy: (t, { asc }) => [asc(t.code)],
    });
  }
}
