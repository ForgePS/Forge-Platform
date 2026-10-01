import { Inject, Injectable } from "@nestjs/common";
import {
  createApparatusInputSchema,
  createHydrantDamageReportInputSchema,
  createHydrantFlowTestInputSchema,
  createHydrantInspectionInputSchema,
  createHydrantInputSchema,
  createEquipmentAssignmentInputSchema,
  createEquipmentInputSchema,
  createEquipmentMeterReadingInputSchema,
  createInventoryItemInputSchema,
  createInventoryTransactionInputSchema,
  patchEquipmentInputSchema,
  patchInventoryItemInputSchema,
  createOccupancyInputSchema,
  createPreplanInputSchema,
  createRmsPersonnelInputSchema,
  createShiftInputSchema,
  createStationInputSchema,
  createUnitInputSchema,
  pageQuerySchema,
} from "@forge/contracts";
import {
  createId,
  rmsApparatus,
  rmsDailyRosters,
  rmsHydrantDamageReports,
  rmsHydrantFlowTests,
  rmsHydrantInspections,
  rmsHydrants,
  rmsEquipment,
  rmsEquipmentAssignmentHistory,
  rmsEquipmentMeterReadings,
  rmsInventoryItems,
  rmsInventoryTransactions,
  rmsOccupancies,
  rmsPersonnel,
  rmsPreplans,
  rmsRosterAssignments,
  rmsShifts,
  rmsStations,
  rmsUnits,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, count, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { concurrencyConflict } from "../../common/concurrency.js";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";

type ExpectedVersion = number | "*";

type RmsResourceTable =
  | typeof rmsStations
  | typeof rmsShifts
  | typeof rmsApparatus
  | typeof rmsUnits
  | typeof rmsPersonnel
  | typeof rmsHydrants
  | typeof rmsEquipment
  | typeof rmsInventoryItems
  | typeof rmsOccupancies
  | typeof rmsPreplans;

type RmsResourceRow = {
  id: string;
  tenantId: string;
  recordVersion: number;
  deletedAt: Date | null;
};

const rosterCreateSchema = z.object({
  rosterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftId: z.string().uuid(),
  stationId: z.string().uuid(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const rosterAssignmentSchema = z.object({
  personnelId: z.string().uuid(),
  unitId: z.string().uuid().optional().nullable(),
  assignmentRole: z.string().max(80).default("MEMBER"),
  isOfficer: z.boolean().default(false),
  incidentCommanderEligible: z.boolean().default(false),
});

function patchFromCreate<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.partial();
}

@Injectable()
export class RmsMasterDataService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  // --- stations ---

  async createStation(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createStationInputSchema.parse(input);
    return this.createResource(tenantId, "rms_station", rmsStations, data, principal, {
      stationNumber: data.stationNumber,
      name: data.name,
      status: data.status,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      timezone: data.timezone,
      defaultResponseDistrict: data.defaultResponseDistrict,
    });
  }

  async listStations(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsStations, page, pageSize, search, (q) =>
      or(
        ilike(rmsStations.name, q),
        ilike(rmsStations.stationNumber, q),
        ilike(rmsStations.city, q),
      ),
    );
  }

  async getStation(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsStations, id, "rms_station");
  }

  async patchStation(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createStationInputSchema).parse(input);
    return this.patchResource(tenantId, "rms_station", rmsStations, id, data, principal, expected);
  }

  async deleteStation(tenantId: string, id: string, principal: ForgePrincipal, expected: ExpectedVersion) {
    return this.softDelete(tenantId, "rms_station", rmsStations, id, principal, expected);
  }

  // --- shifts ---

  async createShift(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createShiftInputSchema.parse(input);
    return this.createResource(tenantId, "rms_shift", rmsShifts, data, principal, {
      name: data.name,
      code: data.code,
      status: data.status,
      scheduleReference: data.scheduleReference,
    });
  }

  async listShifts(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsShifts, page, pageSize, search, (q) =>
      or(ilike(rmsShifts.name, q), ilike(rmsShifts.code, q)),
    );
  }

  async getShift(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsShifts, id, "rms_shift");
  }

  async patchShift(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createShiftInputSchema).parse(input);
    return this.patchResource(tenantId, "rms_shift", rmsShifts, id, data, principal, expected);
  }

  async deleteShift(tenantId: string, id: string, principal: ForgePrincipal, expected: ExpectedVersion) {
    return this.softDelete(tenantId, "rms_shift", rmsShifts, id, principal, expected);
  }

  // --- apparatus ---

  async createApparatus(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createApparatusInputSchema.parse(input);
    return this.createResource(tenantId, "rms_apparatus", rmsApparatus, data, principal, {
      apparatusNumber: data.apparatusNumber,
      name: data.name,
      apparatusType: data.apparatusType,
      stationId: data.stationId,
      status: data.status,
      nerisClassification: data.nerisClassification,
    });
  }

  async listApparatus(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsApparatus, page, pageSize, search, (q) =>
      or(
        ilike(rmsApparatus.name, q),
        ilike(rmsApparatus.apparatusNumber, q),
        ilike(rmsApparatus.apparatusType, q),
      ),
    );
  }

  async getApparatus(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsApparatus, id, "rms_apparatus");
  }

  async patchApparatus(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createApparatusInputSchema).parse(input);
    return this.patchResource(tenantId, "rms_apparatus", rmsApparatus, id, data, principal, expected);
  }

  async deleteApparatus(
    tenantId: string,
    id: string,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    return this.softDelete(tenantId, "rms_apparatus", rmsApparatus, id, principal, expected);
  }

  // --- units ---

  async createUnit(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createUnitInputSchema.parse(input);
    return this.createResource(tenantId, "rms_unit", rmsUnits, data, principal, {
      unitNumber: data.unitNumber,
      callSign: data.callSign,
      unitType: data.unitType,
      apparatusId: data.apparatusId,
      stationId: data.stationId,
      status: data.status,
    });
  }

  async listUnits(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsUnits, page, pageSize, search, (q) =>
      or(
        ilike(rmsUnits.unitNumber, q),
        ilike(rmsUnits.callSign, q),
        ilike(rmsUnits.unitType, q),
      ),
    );
  }

  async getUnit(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsUnits, id, "rms_unit");
  }

  async patchUnit(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createUnitInputSchema).parse(input);
    return this.patchResource(tenantId, "rms_unit", rmsUnits, id, data, principal, expected);
  }

  async deleteUnit(tenantId: string, id: string, principal: ForgePrincipal, expected: ExpectedVersion) {
    return this.softDelete(tenantId, "rms_unit", rmsUnits, id, principal, expected);
  }

  // --- personnel ---

  async createPersonnel(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createRmsPersonnelInputSchema.parse(input);
    return this.createResource(tenantId, "rms_personnel", rmsPersonnel, data, principal, {
      personId: data.personId,
      rank: data.rank,
      qualificationSummary: data.qualificationSummary,
      stationId: data.stationId,
      shiftId: data.shiftId,
      status: data.status,
      incidentEligible: data.incidentEligible,
    });
  }

  async listPersonnel(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsPersonnel, page, pageSize, search, (q) =>
      or(ilike(rmsPersonnel.rank, q), ilike(rmsPersonnel.qualificationSummary, q)),
    );
  }

  async getPersonnel(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsPersonnel, id, "rms_personnel");
  }

  async patchPersonnel(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createRmsPersonnelInputSchema).parse(input);
    return this.patchResource(tenantId, "rms_personnel", rmsPersonnel, id, data, principal, expected);
  }

  async deletePersonnel(
    tenantId: string,
    id: string,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    return this.softDelete(tenantId, "rms_personnel", rmsPersonnel, id, principal, expected);
  }

  // --- hydrants ---

  async createHydrant(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createHydrantInputSchema.parse(input);
    return this.createResource(tenantId, "rms_hydrant", rmsHydrants, data, principal, data);
  }

  async listHydrants(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsHydrants, page, pageSize, search, (q) =>
      or(
        ilike(rmsHydrants.displayId, q),
        ilike(rmsHydrants.addressLine1, q),
        ilike(rmsHydrants.city, q),
        ilike(rmsHydrants.waterProvider, q),
      ),
    );
  }

  async getHydrant(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsHydrants, id, "rms_hydrant");
  }

  async patchHydrant(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createHydrantInputSchema).parse(input);
    return this.patchResource(tenantId, "rms_hydrant", rmsHydrants, id, data, principal, expected);
  }

  async deleteHydrant(
    tenantId: string,
    id: string,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    return this.softDelete(tenantId, "rms_hydrant", rmsHydrants, id, principal, expected);
  }

  async listHydrantFlowTests(tenantId: string, hydrantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const hydrant = await tx.query.rmsHydrants.findFirst({
        where: and(
          eq(rmsHydrants.tenantId, tenantId),
          eq(rmsHydrants.id, hydrantId),
          isNull(rmsHydrants.deletedAt),
        ),
      });
      if (!hydrant) throw new ForgeError("NOT_FOUND", "rms_hydrant not found");
      return tx.query.rmsHydrantFlowTests.findMany({
        where: and(
          eq(rmsHydrantFlowTests.tenantId, tenantId),
          eq(rmsHydrantFlowTests.hydrantId, hydrantId),
        ),
        orderBy: (table, { desc }) => [desc(table.testDate), desc(table.createdAt)],
      });
    });
  }

  async createHydrantFlowTest(
    tenantId: string,
    hydrantId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = createHydrantFlowTestInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const hydrant = await tx.query.rmsHydrants.findFirst({
        where: and(
          eq(rmsHydrants.tenantId, tenantId),
          eq(rmsHydrants.id, hydrantId),
          isNull(rmsHydrants.deletedAt),
        ),
      });
      if (!hydrant) throw new ForgeError("NOT_FOUND", "rms_hydrant not found");
      const id = createId();
      const now = new Date();
      const [row] = await tx.insert(rmsHydrantFlowTests).values({
        id,
        tenantId,
        hydrantId,
        ...data,
        createdByUserId: principal.userId,
        createdAt: now,
      }).returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create hydrant flow test");

      const [updatedHydrant] = await tx.update(rmsHydrants).set({
        lastFlowTestDate: data.testDate,
        staticPsi: data.staticPsi,
        residualPsi: data.residualPsi,
        dischargeSize: data.dischargeSize ?? hydrant.dischargeSize,
        flowGpm: data.flowGpm,
        nfpaClass: data.nfpaClass,
        nfpaColor: data.nfpaColor,
        recordVersion: hydrant.recordVersion + 1,
        updatedByUserId: principal.userId,
        updatedAt: now,
      }).where(and(eq(rmsHydrants.id, hydrantId), eq(rmsHydrants.recordVersion, hydrant.recordVersion))).returning();
      if (!updatedHydrant) throw concurrencyConflict({
        tenantId,
        resourceType: "rms_hydrant",
        resourceId: hydrantId,
        expectedVersion: hydrant.recordVersion,
        actualVersion: null,
      });

      await this.emitMasterDataUpdated(tx, tenantId, "rms_hydrant_flow_test", id, principal, "create", row);
      await this.emitMasterDataUpdated(tx, tenantId, "rms_hydrant", hydrantId, principal, "flow_test", updatedHydrant, hydrant);
      return { flowTest: row, hydrant: updatedHydrant };
    }, principal.userId);
  }

  async listHydrantInspections(tenantId: string, hydrantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const hydrant = await tx.query.rmsHydrants.findFirst({
        where: and(eq(rmsHydrants.tenantId, tenantId), eq(rmsHydrants.id, hydrantId), isNull(rmsHydrants.deletedAt)),
      });
      if (!hydrant) throw new ForgeError("NOT_FOUND", "rms_hydrant not found");
      return tx.query.rmsHydrantInspections.findMany({
        where: and(eq(rmsHydrantInspections.tenantId, tenantId), eq(rmsHydrantInspections.hydrantId, hydrantId)),
        orderBy: (table, { desc }) => [desc(table.inspectionAt), desc(table.createdAt)],
      });
    });
  }

  async createHydrantInspection(tenantId: string, hydrantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createHydrantInspectionInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const hydrant = await tx.query.rmsHydrants.findFirst({
        where: and(eq(rmsHydrants.tenantId, tenantId), eq(rmsHydrants.id, hydrantId), isNull(rmsHydrants.deletedAt)),
      });
      if (!hydrant) throw new ForgeError("NOT_FOUND", "rms_hydrant not found");
      const id = createId();
      const now = new Date();
      const [row] = await tx.insert(rmsHydrantInspections).values({
        id, tenantId, hydrantId, inspectionAt: new Date(data.inspectionDate),
        operationalStatus: data.operationalStatus, inspector: data.inspector,
        checklistJson: data.checklist, issueCount: data.issueCount, notes: data.notes,
        createdByUserId: principal.userId, createdAt: now,
      }).returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create hydrant inspection");
      const [updatedHydrant] = await tx.update(rmsHydrants).set({
        status: data.operationalStatus, lastInspectionDate: data.inspectionDate.slice(0, 10),
        recordVersion: hydrant.recordVersion + 1, updatedByUserId: principal.userId, updatedAt: now,
      }).where(and(eq(rmsHydrants.id, hydrantId), eq(rmsHydrants.recordVersion, hydrant.recordVersion))).returning();
      if (!updatedHydrant) throw concurrencyConflict({tenantId,resourceType:"rms_hydrant",resourceId:hydrantId,expectedVersion:hydrant.recordVersion,actualVersion:null});
      await this.emitMasterDataUpdated(tx, tenantId, "rms_hydrant_inspection", id, principal, "create", row);
      await this.emitMasterDataUpdated(tx, tenantId, "rms_hydrant", hydrantId, principal, "inspection", updatedHydrant, hydrant);
      return { inspection: row, hydrant: updatedHydrant };
    }, principal.userId);
  }

  async listHydrantDamageReports(tenantId: string, hydrantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const hydrant = await tx.query.rmsHydrants.findFirst({
        where: and(eq(rmsHydrants.tenantId, tenantId), eq(rmsHydrants.id, hydrantId), isNull(rmsHydrants.deletedAt)),
      });
      if (!hydrant) throw new ForgeError("NOT_FOUND", "rms_hydrant not found");
      return tx.query.rmsHydrantDamageReports.findMany({
        where: and(eq(rmsHydrantDamageReports.tenantId, tenantId), eq(rmsHydrantDamageReports.hydrantId, hydrantId)),
        orderBy: (table, { desc }) => [desc(table.reportedAt), desc(table.createdAt)],
      });
    });
  }

  async createHydrantDamageReport(tenantId: string, hydrantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createHydrantDamageReportInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const hydrant = await tx.query.rmsHydrants.findFirst({
        where: and(eq(rmsHydrants.tenantId, tenantId), eq(rmsHydrants.id, hydrantId), isNull(rmsHydrants.deletedAt)),
      });
      if (!hydrant) throw new ForgeError("NOT_FOUND", "rms_hydrant not found");
      const id = createId();
      const now = new Date();
      const [row] = await tx.insert(rmsHydrantDamageReports).values({
        id, tenantId, hydrantId, reportedAt: new Date(data.reportedAt), severity: data.severity,
        operationalStatus: data.operationalStatus, leakPresent: data.leakPresent,
        trafficHazard: data.trafficHazard, alternateWaterSupply: data.alternateWaterSupply,
        waterProvider: data.waterProvider, workOrderReference: data.workOrderReference,
        reportedBy: data.reportedBy, notes: data.notes, createdByUserId: principal.userId, createdAt: now,
      }).returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create hydrant damage report");
      const [updatedHydrant] = await tx.update(rmsHydrants).set({
        status: data.operationalStatus, issue: data.notes ?? hydrant.issue,
        alternateSupply: data.alternateWaterSupply ?? hydrant.alternateSupply,
        recordVersion: hydrant.recordVersion + 1, updatedByUserId: principal.userId, updatedAt: now,
      }).where(and(eq(rmsHydrants.id, hydrantId), eq(rmsHydrants.recordVersion, hydrant.recordVersion))).returning();
      if (!updatedHydrant) throw concurrencyConflict({tenantId,resourceType:"rms_hydrant",resourceId:hydrantId,expectedVersion:hydrant.recordVersion,actualVersion:null});
      await this.emitMasterDataUpdated(tx, tenantId, "rms_hydrant_damage_report", id, principal, "create", row);
      await this.emitMasterDataUpdated(tx, tenantId, "rms_hydrant", hydrantId, principal, "damage_report", updatedHydrant, hydrant);
      return { damageReport: row, hydrant: updatedHydrant };
    }, principal.userId);
  }

  // --- equipment ---

  async createEquipment(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createEquipmentInputSchema.parse(input);
    const assignmentTargets = [data.stationId, data.apparatusId, data.personnelId, data.storageLocation].filter(Boolean);
    if (assignmentTargets.length > 1) {
      throw new ForgeError("BAD_REQUEST", "Equipment may have only one current assignment target");
    }
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const id = createId();
      const now = new Date();
      const [row] = await tx.insert(rmsEquipment).values({
        id, tenantId,
        assetTag: data.assetTag, name: data.name, category: data.category,
        serialNumber: data.serialNumber, manufacturer: data.manufacturer, model: data.model,
        status: data.status, stationId: data.stationId, apparatusId: data.apparatusId,
        personnelId: data.personnelId, storageLocation: data.storageLocation,
        purchaseDate: data.purchaseDate, inServiceDate: data.inServiceDate,
        expirationDate: data.expirationDate, lastServiceDate: data.lastServiceDate,
        nextServiceDate: data.nextServiceDate, notes: data.notes,
        createdByUserId: principal.userId, updatedByUserId: principal.userId,
        createdAt: now, updatedAt: now,
      }).returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create rms_equipment");
      await this.emitMasterDataUpdated(tx, tenantId, "rms_equipment", id, principal, "create", row);
      if (assignmentTargets.length === 1) {
        const assignmentType = data.stationId ? "STATION" : data.apparatusId ? "APPARATUS" : data.personnelId ? "PERSONNEL" : "STORAGE";
        const assignmentId = createId();
        const [assignment] = await tx.insert(rmsEquipmentAssignmentHistory).values({
          id: assignmentId, tenantId, equipmentId: id, assignmentType,
          stationId: data.stationId ?? null, apparatusId: data.apparatusId ?? null,
          personnelId: data.personnelId ?? null, storageLocation: data.storageLocation ?? null,
          assignedAt: now, releasedAt: null, notes: "Initial assignment",
          createdByUserId: principal.userId, createdAt: now,
        }).returning();
        if (!assignment) throw new ForgeError("INTERNAL_ERROR", "Failed to create initial equipment assignment");
        await this.emitMasterDataUpdated(tx, tenantId, "rms_equipment_assignment", assignmentId, principal, "create", assignment);
      }
      return row;
    }, principal.userId);
  }

  async listEquipment(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsEquipment, page, pageSize, search, (q) =>
      or(
        ilike(rmsEquipment.assetTag, q),
        ilike(rmsEquipment.name, q),
        ilike(rmsEquipment.category, q),
        ilike(rmsEquipment.serialNumber, q),
      ),
    );
  }

  async getEquipment(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsEquipment, id, "rms_equipment");
  }

  async patchEquipment(tenantId: string, id: string, input: unknown, principal: ForgePrincipal, expected: ExpectedVersion) {
    const data = patchEquipmentInputSchema.parse(input);
    return this.patchResource(tenantId, "rms_equipment", rmsEquipment, id, data, principal, expected);
  }

  async deleteEquipment(tenantId: string, id: string, principal: ForgePrincipal, expected: ExpectedVersion) {
    return this.softDelete(tenantId, "rms_equipment", rmsEquipment, id, principal, expected);
  }

  async listEquipmentAssignments(tenantId: string, equipmentId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const equipment = await tx.query.rmsEquipment.findFirst({
        where: and(eq(rmsEquipment.tenantId, tenantId), eq(rmsEquipment.id, equipmentId), isNull(rmsEquipment.deletedAt)),
      });
      if (!equipment) throw new ForgeError("NOT_FOUND", "rms_equipment not found");
      return tx.query.rmsEquipmentAssignmentHistory.findMany({
        where: and(eq(rmsEquipmentAssignmentHistory.tenantId, tenantId), eq(rmsEquipmentAssignmentHistory.equipmentId, equipmentId)),
        orderBy: (table, { desc }) => [desc(table.assignedAt), desc(table.createdAt)],
      });
    });
  }

  async assignEquipment(tenantId: string, equipmentId: string, input: unknown, principal: ForgePrincipal) {
    const data = createEquipmentAssignmentInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const equipment = await tx.query.rmsEquipment.findFirst({
        where: and(eq(rmsEquipment.tenantId, tenantId), eq(rmsEquipment.id, equipmentId), isNull(rmsEquipment.deletedAt)),
      });
      if (!equipment) throw new ForgeError("NOT_FOUND", "rms_equipment not found");
      const assignedAt = new Date(data.assignedAt);
      await tx.update(rmsEquipmentAssignmentHistory).set({ releasedAt: assignedAt }).where(
        and(
          eq(rmsEquipmentAssignmentHistory.tenantId, tenantId),
          eq(rmsEquipmentAssignmentHistory.equipmentId, equipmentId),
          isNull(rmsEquipmentAssignmentHistory.releasedAt),
        ),
      );
      const id = createId();
      const now = new Date();
      const stationId = data.assignmentType === "STATION" ? data.stationId : null;
      const apparatusId = data.assignmentType === "APPARATUS" ? data.apparatusId : null;
      const personnelId = data.assignmentType === "PERSONNEL" ? data.personnelId : null;
      const storageLocation = data.assignmentType === "STORAGE" ? data.storageLocation : null;
      const [assignment] = await tx.insert(rmsEquipmentAssignmentHistory).values({
        id, tenantId, equipmentId, assignmentType: data.assignmentType,
        stationId, apparatusId, personnelId, storageLocation,
        assignedAt, releasedAt: data.releasedAt ? new Date(data.releasedAt) : null,
        notes: data.notes, createdByUserId: principal.userId, createdAt: now,
      }).returning();
      if (!assignment) throw new ForgeError("INTERNAL_ERROR", "Failed to create equipment assignment");
      const [updated] = await tx.update(rmsEquipment).set({
        stationId, apparatusId, personnelId, storageLocation,
        recordVersion: equipment.recordVersion + 1,
        updatedByUserId: principal.userId, updatedAt: now,
      }).where(and(eq(rmsEquipment.id, equipmentId), eq(rmsEquipment.recordVersion, equipment.recordVersion))).returning();
      if (!updated) throw concurrencyConflict({tenantId,resourceType:"rms_equipment",resourceId:equipmentId,expectedVersion:equipment.recordVersion,actualVersion:null});
      await this.emitMasterDataUpdated(tx, tenantId, "rms_equipment_assignment", id, principal, "create", assignment);
      await this.emitMasterDataUpdated(tx, tenantId, "rms_equipment", equipmentId, principal, "assign", updated, equipment);
      return { assignment, equipment: updated };
    }, principal.userId);
  }

  async listEquipmentMeterReadings(tenantId: string, equipmentId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const equipment = await tx.query.rmsEquipment.findFirst({
        where: and(eq(rmsEquipment.tenantId, tenantId), eq(rmsEquipment.id, equipmentId), isNull(rmsEquipment.deletedAt)),
      });
      if (!equipment) throw new ForgeError("NOT_FOUND", "rms_equipment not found");
      return tx.query.rmsEquipmentMeterReadings.findMany({
        where: and(eq(rmsEquipmentMeterReadings.tenantId, tenantId), eq(rmsEquipmentMeterReadings.equipmentId, equipmentId)),
        orderBy: (table, { desc }) => [desc(table.recordedAt), desc(table.createdAt)],
      });
    });
  }

  async createEquipmentMeterReading(tenantId: string, equipmentId: string, input: unknown, principal: ForgePrincipal) {
    const data = createEquipmentMeterReadingInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const equipment = await tx.query.rmsEquipment.findFirst({
        where: and(eq(rmsEquipment.tenantId, tenantId), eq(rmsEquipment.id, equipmentId), isNull(rmsEquipment.deletedAt)),
      });
      if (!equipment) throw new ForgeError("NOT_FOUND", "rms_equipment not found");
      const id = createId();
      const [row] = await tx.insert(rmsEquipmentMeterReadings).values({
        id, tenantId, equipmentId, meterType: data.meterType, reading: data.reading,
        recordedAt: new Date(data.recordedAt), source: data.source, notes: data.notes,
        createdByUserId: principal.userId, createdAt: new Date(),
      }).returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create equipment meter reading");
      await this.emitMasterDataUpdated(tx, tenantId, "rms_equipment_meter_reading", id, principal, "create", row);
      return row;
    }, principal.userId);
  }

  // --- inventory ---

  async createInventoryItem(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createInventoryItemInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const id = createId();
      const now = new Date();
      const [row] = await tx.insert(rmsInventoryItems).values({
        id, tenantId, itemCode: data.itemCode, name: data.name, category: data.category,
        unitOfMeasure: data.unitOfMeasure, storageLocation: data.storageLocation,
        stationId: data.stationId, apparatusId: data.apparatusId,
        currentQuantity: data.currentQuantity, minimumQuantity: data.minimumQuantity,
        targetQuantity: data.targetQuantity, status: data.status,
        expirationTracked: data.expirationTracked, lotTracked: data.lotTracked,
        notes: data.notes, createdByUserId: principal.userId, updatedByUserId: principal.userId,
        createdAt: now, updatedAt: now,
      }).returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create rms_inventory_item");
      await this.emitMasterDataUpdated(tx, tenantId, "rms_inventory_item", id, principal, "create", row);
      if (data.currentQuantity !== 0) {
        const transactionId = createId();
        const [opening] = await tx.insert(rmsInventoryTransactions).values({
          id: transactionId, tenantId, inventoryItemId: id,
          transactionType: "ADJUST", quantityDelta: data.currentQuantity,
          quantityAfter: data.currentQuantity, reason: "Opening balance",
          occurredAt: now, createdByUserId: principal.userId, createdAt: now,
        }).returning();
        if (!opening) throw new ForgeError("INTERNAL_ERROR", "Failed to create opening inventory transaction");
        await this.emitMasterDataUpdated(tx, tenantId, "rms_inventory_transaction", transactionId, principal, "create", opening);
      }
      return row;
    }, principal.userId);
  }

  async listInventoryItems(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsInventoryItems, page, pageSize, search, (q) =>
      or(
        ilike(rmsInventoryItems.itemCode, q),
        ilike(rmsInventoryItems.name, q),
        ilike(rmsInventoryItems.category, q),
        ilike(rmsInventoryItems.storageLocation, q),
      ),
    );
  }

  async getInventoryItem(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsInventoryItems, id, "rms_inventory_item");
  }

  async patchInventoryItem(tenantId: string, id: string, input: unknown, principal: ForgePrincipal, expected: ExpectedVersion) {
    const data = patchInventoryItemInputSchema.parse(input);
    return this.patchResource(tenantId, "rms_inventory_item", rmsInventoryItems, id, data, principal, expected);
  }

  async deleteInventoryItem(tenantId: string, id: string, principal: ForgePrincipal, expected: ExpectedVersion) {
    return this.softDelete(tenantId, "rms_inventory_item", rmsInventoryItems, id, principal, expected);
  }

  async listInventoryTransactions(tenantId: string, inventoryItemId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const item = await tx.query.rmsInventoryItems.findFirst({
        where: and(eq(rmsInventoryItems.tenantId, tenantId), eq(rmsInventoryItems.id, inventoryItemId), isNull(rmsInventoryItems.deletedAt)),
      });
      if (!item) throw new ForgeError("NOT_FOUND", "rms_inventory_item not found");
      return tx.query.rmsInventoryTransactions.findMany({
        where: and(eq(rmsInventoryTransactions.tenantId, tenantId), eq(rmsInventoryTransactions.inventoryItemId, inventoryItemId)),
        orderBy: (table, { desc }) => [desc(table.occurredAt), desc(table.createdAt)],
      });
    });
  }

  async createInventoryTransaction(tenantId: string, inventoryItemId: string, input: unknown, principal: ForgePrincipal) {
    const data = createInventoryTransactionInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const item = await tx.query.rmsInventoryItems.findFirst({
        where: and(eq(rmsInventoryItems.tenantId, tenantId), eq(rmsInventoryItems.id, inventoryItemId), isNull(rmsInventoryItems.deletedAt)),
      });
      if (!item) throw new ForgeError("NOT_FOUND", "rms_inventory_item not found");
      const quantityAfter = item.currentQuantity + data.quantityDelta;
      if (quantityAfter < 0) throw new ForgeError("BAD_REQUEST", "Inventory transaction would create a negative balance");
      const id = createId();
      const now = new Date();
      const [transaction] = await tx.insert(rmsInventoryTransactions).values({
        id, tenantId, inventoryItemId, transactionType: data.transactionType,
        quantityDelta: data.quantityDelta, quantityAfter,
        referenceType: data.referenceType, referenceId: data.referenceId,
        lotNumber: data.lotNumber, expirationDate: data.expirationDate,
        reason: data.reason, occurredAt: new Date(data.occurredAt),
        performedByPersonnelId: data.performedByPersonnelId,
        createdByUserId: principal.userId, createdAt: now,
      }).returning();
      if (!transaction) throw new ForgeError("INTERNAL_ERROR", "Failed to create inventory transaction");
      const [updated] = await tx.update(rmsInventoryItems).set({
        currentQuantity: quantityAfter,
        recordVersion: item.recordVersion + 1,
        updatedByUserId: principal.userId,
        updatedAt: now,
      }).where(and(eq(rmsInventoryItems.id, inventoryItemId), eq(rmsInventoryItems.recordVersion, item.recordVersion))).returning();
      if (!updated) throw concurrencyConflict({tenantId,resourceType:"rms_inventory_item",resourceId:inventoryItemId,expectedVersion:item.recordVersion,actualVersion:null});
      await this.emitMasterDataUpdated(tx, tenantId, "rms_inventory_transaction", id, principal, "create", transaction);
      await this.emitMasterDataUpdated(tx, tenantId, "rms_inventory_item", inventoryItemId, principal, "transaction", updated, item);
      return { transaction, inventoryItem: updated };
    }, principal.userId);
  }

  // --- occupancies ---

  async createOccupancy(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createOccupancyInputSchema.parse(input);
    return this.createResource(tenantId, "rms_occupancy", rmsOccupancies, data, principal, {
      name: data.name,
      addressLine1: data.addressLine1,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      latitude: data.latitude,
      longitude: data.longitude,
      primaryContact: data.primaryContact,
      occupancyType: data.occupancyType,
      status: data.status,
      preplanId: data.preplanId,
    });
  }

  async listOccupancies(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsOccupancies, page, pageSize, search, (q) =>
      or(
        ilike(rmsOccupancies.name, q),
        ilike(rmsOccupancies.addressLine1, q),
        ilike(rmsOccupancies.city, q),
      ),
    );
  }

  async getOccupancy(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsOccupancies, id, "rms_occupancy");
  }

  async patchOccupancy(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createOccupancyInputSchema).parse(input);
    return this.patchResource(
      tenantId,
      "rms_occupancy",
      rmsOccupancies,
      id,
      data,
      principal,
      expected,
    );
  }

  async deleteOccupancy(
    tenantId: string,
    id: string,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    return this.softDelete(tenantId, "rms_occupancy", rmsOccupancies, id, principal, expected);
  }

  // --- preplans ---

  async createPreplan(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createPreplanInputSchema.parse(input);
    return this.createResource(tenantId, "rms_preplan", rmsPreplans, data, principal, {
      occupancyId: data.occupancyId,
      versionLabel: data.versionLabel,
      approvalStatus: data.approvalStatus,
      tacticalSummary: data.tacticalSummary,
      hazards: data.hazards,
      accessNotes: data.accessNotes,
      utilityNotes: data.utilityNotes,
      primaryStationId: data.primaryStationId,
    });
  }

  async listPreplans(tenantId: string, query: unknown) {
    const { page, pageSize, search } = pageQuerySchema.parse(query ?? {});
    return this.listResource(tenantId, rmsPreplans, page, pageSize, search, (q) =>
      or(
        ilike(rmsPreplans.versionLabel, q),
        ilike(rmsPreplans.tacticalSummary, q),
        ilike(rmsPreplans.hazards, q),
      ),
    );
  }

  async getPreplan(tenantId: string, id: string) {
    return this.getResource(tenantId, rmsPreplans, id, "rms_preplan");
  }

  async patchPreplan(
    tenantId: string,
    id: string,
    input: unknown,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    const data = patchFromCreate(createPreplanInputSchema).parse(input);
    return this.patchResource(tenantId, "rms_preplan", rmsPreplans, id, data, principal, expected);
  }

  async deletePreplan(
    tenantId: string,
    id: string,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    return this.softDelete(tenantId, "rms_preplan", rmsPreplans, id, principal, expected);
  }

  // --- rosters ---

  async createRoster(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = rosterCreateSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const id = createId();
      const now = new Date();
      const [row] = await tx
        .insert(rmsDailyRosters)
        .values({
          id,
          tenantId,
          rosterDate: data.rosterDate,
          shiftId: data.shiftId,
          stationId: data.stationId,
          status: data.status,
          createdByUserId: principal.userId,
          updatedByUserId: principal.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create roster");
      await this.emitMasterDataUpdated(tx, tenantId, "rms_roster", id, principal, "create");
      return row;
    }, principal.userId);
  }

  async listRosters(tenantId: string, query: unknown) {
    const { page, pageSize } = pageQuerySchema.parse(query ?? {});
    const offset = (page - 1) * pageSize;
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const where = eq(rmsDailyRosters.tenantId, tenantId);
      const items = await tx
        .select()
        .from(rmsDailyRosters)
        .where(where)
        .orderBy(sql`${rmsDailyRosters.rosterDate} desc`)
        .limit(pageSize)
        .offset(offset);
      const totalRows = await tx.select({ total: count() }).from(rmsDailyRosters).where(where);
      return { items, page, pageSize, total: totalRows[0]?.total ?? 0 };
    });
  }

  async getRoster(tenantId: string, id: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const row = await tx.query.rmsDailyRosters.findFirst({
        where: and(eq(rmsDailyRosters.id, id), eq(rmsDailyRosters.tenantId, tenantId)),
      });
      if (!row) throw new ForgeError("NOT_FOUND", "Roster not found");
      const assignments = await tx.query.rmsRosterAssignments.findMany({
        where: eq(rmsRosterAssignments.rosterId, id),
      });
      return { ...row, assignments };
    });
  }

  async addRosterAssignment(
    tenantId: string,
    rosterId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = rosterAssignmentSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const roster = await tx.query.rmsDailyRosters.findFirst({
        where: and(eq(rmsDailyRosters.id, rosterId), eq(rmsDailyRosters.tenantId, tenantId)),
      });
      if (!roster) throw new ForgeError("NOT_FOUND", "Roster not found");
      const id = createId();
      const now = new Date();
      const [row] = await tx
        .insert(rmsRosterAssignments)
        .values({
          id,
          tenantId,
          rosterId,
          personnelId: data.personnelId,
          unitId: data.unitId,
          assignmentRole: data.assignmentRole,
          isOfficer: data.isOfficer,
          incidentCommanderEligible: data.incidentCommanderEligible,
          createdByUserId: principal.userId,
          updatedByUserId: principal.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create roster assignment");
      await this.emitMasterDataUpdated(tx, tenantId, "rms_roster_assignment", id, principal, "create");
      return row;
    }, principal.userId);
  }

  async removeRosterAssignment(tenantId: string, rosterId: string, assignmentId: string, principal: ForgePrincipal) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const assignment = await tx.query.rmsRosterAssignments.findFirst({
        where: and(
          eq(rmsRosterAssignments.id, assignmentId),
          eq(rmsRosterAssignments.rosterId, rosterId),
          eq(rmsRosterAssignments.tenantId, tenantId),
        ),
      });
      if (!assignment) throw new ForgeError("NOT_FOUND", "Roster assignment not found");
      await tx.delete(rmsRosterAssignments).where(eq(rmsRosterAssignments.id, assignmentId));
      await this.emitMasterDataUpdated(
        tx,
        tenantId,
        "rms_roster_assignment",
        assignmentId,
        principal,
        "delete",
      );
      return { deleted: true, assignmentId };
    }, principal.userId);
  }

  // --- shared helpers ---

  private async createResource<T extends Record<string, unknown>>(
    tenantId: string,
    resourceType: string,
    table: RmsResourceTable,
    _parsed: unknown,
    principal: ForgePrincipal,
    values: T,
  ) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const id = createId();
      const now = new Date();
      const [row] = await tx
        .insert(table)
        .values({
          id,
          tenantId,
          ...values,
          createdByUserId: principal.userId,
          updatedByUserId: principal.userId,
          createdAt: now,
          updatedAt: now,
        } as never)
        .returning();
      if (!row) throw new ForgeError("INTERNAL_ERROR", `Failed to create ${resourceType}`);
      await this.emitMasterDataUpdated(tx, tenantId, resourceType, id, principal, "create", row);
      return row;
    }, principal.userId);
  }

  private async listResource(
    tenantId: string,
    table: RmsResourceTable,
    page: number,
    pageSize: number,
    search: string | undefined,
    searchFilter: (q: string) => ReturnType<typeof or>,
  ) {
    const offset = (page - 1) * pageSize;
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const filters = [eq(table.tenantId, tenantId), isNull(table.deletedAt)];
      if (search?.trim()) {
        filters.push(searchFilter(`%${search.trim()}%`)!);
      }
      const where = and(...filters);
      const items = await tx.select().from(table).where(where).limit(pageSize).offset(offset);
      const totalRows = await tx.select({ total: count() }).from(table).where(where);
      return { items, page, pageSize, total: totalRows[0]?.total ?? 0 };
    });
  }

  private async getResource(tenantId: string, table: RmsResourceTable, id: string, resourceType: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(table)
        .where(and(eq(table.id, id), eq(table.tenantId, tenantId), isNull(table.deletedAt)))
        .limit(1);
      if (!row) throw new ForgeError("NOT_FOUND", `${resourceType} not found`);
      return row;
    });
  }

  private async patchResource(
    tenantId: string,
    resourceType: string,
    table: RmsResourceTable,
    id: string,
    data: Record<string, unknown>,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const [before] = await tx
        .select()
        .from(table)
        .where(and(eq(table.id, id), eq(table.tenantId, tenantId), isNull(table.deletedAt)))
        .limit(1);
      if (!before) throw new ForgeError("NOT_FOUND", `${resourceType} not found`);
      const version = (before as RmsResourceRow).recordVersion;
      if (expected !== "*" && version !== expected) {
        throw concurrencyConflict({
          tenantId,
          resourceType,
          resourceId: id,
          expectedVersion: expected,
          actualVersion: version,
        });
      }
      const [updated] = await tx
        .update(table)
        .set({
          ...data,
          recordVersion: version + 1,
          updatedByUserId: principal.userId,
          updatedAt: new Date(),
        } as never)
        .where(and(eq(table.id, id), eq(table.recordVersion, version)))
        .returning();
      if (!updated) {
        throw concurrencyConflict({
          tenantId,
          resourceType,
          resourceId: id,
          expectedVersion: expected,
          actualVersion: null,
        });
      }
      await this.emitMasterDataUpdated(tx, tenantId, resourceType, id, principal, "update", updated, before);
      return updated;
    }, principal.userId);
  }

  private async softDelete(
    tenantId: string,
    resourceType: string,
    table: RmsResourceTable,
    id: string,
    principal: ForgePrincipal,
    expected: ExpectedVersion,
  ) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const [before] = await tx
        .select()
        .from(table)
        .where(and(eq(table.id, id), eq(table.tenantId, tenantId), isNull(table.deletedAt)))
        .limit(1);
      if (!before) throw new ForgeError("NOT_FOUND", `${resourceType} not found`);
      const version = (before as RmsResourceRow).recordVersion;
      if (expected !== "*" && version !== expected) {
        throw concurrencyConflict({
          tenantId,
          resourceType,
          resourceId: id,
          expectedVersion: expected,
          actualVersion: version,
        });
      }
      const now = new Date();
      const [updated] = await tx
        .update(table)
        .set({
          deletedAt: now,
          deletedByUserId: principal.userId,
          recordVersion: version + 1,
          updatedByUserId: principal.userId,
          updatedAt: now,
        } as never)
        .where(and(eq(table.id, id), eq(table.recordVersion, version)))
        .returning();
      if (!updated) {
        throw concurrencyConflict({
          tenantId,
          resourceType,
          resourceId: id,
          expectedVersion: expected,
          actualVersion: null,
        });
      }
      await this.emitMasterDataUpdated(tx, tenantId, resourceType, id, principal, "delete", updated, before);
      return updated;
    }, principal.userId);
  }

  private async emitMasterDataUpdated(
    tx: Parameters<Parameters<typeof withTenantTransaction>[2]>[0],
    tenantId: string,
    resourceType: string,
    resourceId: string,
    principal: ForgePrincipal,
    action: string,
    after?: unknown,
    before?: unknown,
  ) {
    await this.outbox.write(tx, {
      tenantId,
      aggregateType: resourceType,
      aggregateId: resourceId,
      eventType: DOMAIN_EVENT_TYPES.RMS_MASTERDATA_UPDATED,
      payload: { tenantId, resourceType, resourceId, action },
      correlationId: principal.correlationId,
      actorUserId: principal.userId,
    });
    await this.audit.writeInTransaction(tx, {
      tenantId,
      actorUserId: principal.userId,
      actorPersonId: principal.personId,
      actorType: "USER",
      action: `rms.masterdata.${action}`,
      resourceType,
      resourceId,
      result: "SUCCESS",
      riskLevel: "LOW",
      correlationId: principal.correlationId,
      requestId: principal.requestId,
      before,
      after,
    });
  }
}
