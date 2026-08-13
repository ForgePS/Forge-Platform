import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  industrialCorrectiveActions,
  industrialFleetDrivers,
  industrialFleetVehicles,
  industrialLotoProcedures,
  industrialLotoRecords,
  industrialSites,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { and, desc, eq } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

@Injectable()
export class IndustrialService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listSites(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialSites)
        .where(eq(industrialSites.tenantId, tenantId))
        .orderBy(desc(industrialSites.updatedAt));
    });
  }

  async getSite(tenantId: string, siteId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const row = await tx.query.industrialSites.findFirst({
        where: and(eq(industrialSites.id, siteId), eq(industrialSites.tenantId, tenantId)),
      });
      if (!row) throw new ForgeError("NOT_FOUND", "Industrial site not found");
      return row;
    });
  }

  async listLotoProcedures(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialLotoProcedures)
        .where(eq(industrialLotoProcedures.tenantId, tenantId))
        .orderBy(desc(industrialLotoProcedures.updatedAt));
    });
  }

  async listLotoRecords(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialLotoRecords)
        .where(eq(industrialLotoRecords.tenantId, tenantId))
        .orderBy(desc(industrialLotoRecords.updatedAt));
    });
  }

  async listFleetVehicles(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialFleetVehicles)
        .where(eq(industrialFleetVehicles.tenantId, tenantId))
        .orderBy(desc(industrialFleetVehicles.updatedAt));
    });
  }

  async createFleetVehicle(
    tenantId: string,
    input: {
      year?: number;
      make?: string;
      model?: string;
      color?: string;
      vin?: string;
      licensePlate?: string;
      renewalDate?: string;
      locationName?: string;
      countyAssessed?: string;
      insured?: boolean;
      mileage?: number;
      notes?: string;
      vehicleFringe?: boolean;
    },
  ) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const id = createId();
      const now = new Date();
      const [row] = await tx
        .insert(industrialFleetVehicles)
        .values({
          id,
          tenantId,
          year: input.year,
          make: input.make,
          model: input.model,
          color: input.color,
          vin: input.vin,
          licensePlate: input.licensePlate,
          renewalDate: input.renewalDate,
          locationName: input.locationName,
          countyAssessed: input.countyAssessed,
          insured: input.insured,
          mileage: input.mileage,
          notes: input.notes,
          vehicleFringe: input.vehicleFringe,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    });
  }

  async listFleetDrivers(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialFleetDrivers)
        .where(eq(industrialFleetDrivers.tenantId, tenantId))
        .orderBy(desc(industrialFleetDrivers.updatedAt));
    });
  }

  async listCorrectiveActions(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialCorrectiveActions)
        .where(eq(industrialCorrectiveActions.tenantId, tenantId))
        .orderBy(desc(industrialCorrectiveActions.updatedAt));
    });
  }

  async createCorrectiveAction(
    tenantId: string,
    input: {
      title: string;
      parentEntityType: string;
      parentEntityId?: string;
      description?: string;
      priority?: string;
      dueDate?: string;
    },
  ) {
    if (!input.title?.trim()) {
      throw new ForgeError("VALIDATION_FAILED", "title is required");
    }
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const id = createId();
      const now = new Date();
      const [row] = await tx
        .insert(industrialCorrectiveActions)
        .values({
          id,
          tenantId,
          title: input.title.trim(),
          parentEntityType: input.parentEntityType,
          parentEntityId: input.parentEntityId,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate,
          status: "OPEN",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    });
  }
}
