import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  industrialCorrectiveActions,
  industrialDepartments,
  industrialEmploymentTypes,
  industrialFleetDrivers,
  industrialFleetVehicles,
  industrialLotoProcedures,
  industrialLotoRecords,
  industrialPersonnel,
  industrialPositions,
  industrialSites,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
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

  async listDepartments(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialDepartments)
        .where(
          and(eq(industrialDepartments.tenantId, tenantId), isNull(industrialDepartments.archivedAt)),
        )
        .orderBy(desc(industrialDepartments.updatedAt));
    });
  }

  async createDepartment(
    tenantId: string,
    input: { name: string; description?: string },
  ) {
    const name = input.name?.trim();
    if (!name) throw new ForgeError("VALIDATION_FAILED", "name is required");
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const existing = await tx
        .select()
        .from(industrialDepartments)
        .where(
          and(
            eq(industrialDepartments.tenantId, tenantId),
            sql`lower(${industrialDepartments.name}) = ${name.toLowerCase()}`,
            isNull(industrialDepartments.archivedAt),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0];
      const now = new Date();
      const [row] = await tx
        .insert(industrialDepartments)
        .values({
          id: createId(),
          tenantId,
          name,
          status: "ACTIVE",
          sourceSystem: "FORGE",
          sourcePayload: { description: input.description ?? null },
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    });
  }

  async listPositions(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialPositions)
        .where(
          and(eq(industrialPositions.tenantId, tenantId), isNull(industrialPositions.archivedAt)),
        )
        .orderBy(desc(industrialPositions.updatedAt));
    });
  }

  async createPosition(
    tenantId: string,
    input: { name: string; description?: string; departmentId?: string },
  ) {
    const name = input.name?.trim();
    if (!name) throw new ForgeError("VALIDATION_FAILED", "name is required");
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      if (input.departmentId) {
        const dept = await tx.query.industrialDepartments.findFirst({
          where: and(
            eq(industrialDepartments.id, input.departmentId),
            eq(industrialDepartments.tenantId, tenantId),
          ),
        });
        if (!dept) throw new ForgeError("NOT_FOUND", "Department not found");
      }
      const existing = await tx
        .select()
        .from(industrialPositions)
        .where(
          and(
            eq(industrialPositions.tenantId, tenantId),
            sql`lower(${industrialPositions.name}) = ${name.toLowerCase()}`,
            isNull(industrialPositions.archivedAt),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0];
      const now = new Date();
      const [row] = await tx
        .insert(industrialPositions)
        .values({
          id: createId(),
          tenantId,
          name,
          description: input.description,
          departmentId: input.departmentId,
          status: "ACTIVE",
          sourceSystem: "FORGE",
          sourcePayload: { description: input.description ?? null },
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    });
  }

  async archivePosition(tenantId: string, positionId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const existing = await tx.query.industrialPositions.findFirst({
        where: and(
          eq(industrialPositions.id, positionId),
          eq(industrialPositions.tenantId, tenantId),
        ),
      });
      if (!existing || existing.archivedAt) {
        throw new ForgeError("NOT_FOUND", "Position not found");
      }
      const now = new Date();
      const [row] = await tx
        .update(industrialPositions)
        .set({ archivedAt: now, status: "ARCHIVED", updatedAt: now })
        .where(eq(industrialPositions.id, positionId))
        .returning();
      return row;
    });
  }

  async listEmploymentTypes(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialEmploymentTypes)
        .where(
          and(
            eq(industrialEmploymentTypes.tenantId, tenantId),
            isNull(industrialEmploymentTypes.archivedAt),
          ),
        )
        .orderBy(desc(industrialEmploymentTypes.updatedAt));
    });
  }

  async createEmploymentType(
    tenantId: string,
    input: { name: string; description?: string },
  ) {
    const name = input.name?.trim();
    if (!name) throw new ForgeError("VALIDATION_FAILED", "name is required");
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const existing = await tx
        .select()
        .from(industrialEmploymentTypes)
        .where(
          and(
            eq(industrialEmploymentTypes.tenantId, tenantId),
            sql`lower(${industrialEmploymentTypes.name}) = ${name.toLowerCase()}`,
            isNull(industrialEmploymentTypes.archivedAt),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0];
      const now = new Date();
      const [row] = await tx
        .insert(industrialEmploymentTypes)
        .values({
          id: createId(),
          tenantId,
          name,
          description: input.description,
          status: "ACTIVE",
          sourceSystem: "FORGE",
          sourcePayload: { description: input.description ?? null },
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    });
  }

  async archiveEmploymentType(tenantId: string, employmentTypeId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const existing = await tx.query.industrialEmploymentTypes.findFirst({
        where: and(
          eq(industrialEmploymentTypes.id, employmentTypeId),
          eq(industrialEmploymentTypes.tenantId, tenantId),
        ),
      });
      if (!existing || existing.archivedAt) {
        throw new ForgeError("NOT_FOUND", "Employment type not found");
      }
      const now = new Date();
      const [row] = await tx
        .update(industrialEmploymentTypes)
        .set({ archivedAt: now, status: "ARCHIVED", updatedAt: now })
        .where(eq(industrialEmploymentTypes.id, employmentTypeId))
        .returning();
      return row;
    });
  }

  async listPersonnel(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(industrialPersonnel)
        .where(
          and(eq(industrialPersonnel.tenantId, tenantId), isNull(industrialPersonnel.archivedAt)),
        )
        .orderBy(desc(industrialPersonnel.updatedAt));
    });
  }

  async createMissingOrgLookup(
    tenantId: string,
    input: {
      kind: "department" | "position" | "employment_type";
      name: string;
      description?: string;
    },
  ) {
    const name = input.name?.trim();
    if (!name) throw new ForgeError("VALIDATION_FAILED", "name is required");
    if (input.kind === "department") {
      return this.createDepartment(
        tenantId,
        input.description !== undefined ? { name, description: input.description } : { name },
      );
    }
    if (input.kind === "position") {
      return this.createPosition(
        tenantId,
        input.description !== undefined ? { name, description: input.description } : { name },
      );
    }
    if (input.kind === "employment_type") {
      return this.createEmploymentType(
        tenantId,
        input.description !== undefined ? { name, description: input.description } : { name },
      );
    }
    throw new ForgeError("VALIDATION_FAILED", "Invalid org lookup kind");
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
