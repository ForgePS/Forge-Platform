import { Injectable } from "@nestjs/common";
import type { PrefillSource } from "@forge/contracts";
import {
  createId,
  nerisIncidentFieldValues,
  rmsOccupancies,
  rmsPersonnel,
  rmsPreplans,
  rmsStations,
  type DatabaseTransaction,
} from "@forge/database";
import { and, eq, isNull } from "drizzle-orm";

export interface PrefillCandidate {
  fieldKey: string;
  sectionKey: string;
  value: unknown;
  prefillSource: PrefillSource;
}

@Injectable()
export class IncidentPrefillService {
  async loadCandidates(
    tx: DatabaseTransaction,
    tenantId: string,
    input: {
      stationId?: string | null;
      personnelId?: string | null;
      occupancyId?: string | null;
      preplanId?: string | null;
    },
  ): Promise<PrefillCandidate[]> {
    const candidates: PrefillCandidate[] = [];

    if (input.stationId) {
      const [station] = await tx
        .select()
        .from(rmsStations)
        .where(
          and(
            eq(rmsStations.id, input.stationId),
            eq(rmsStations.tenantId, tenantId),
            isNull(rmsStations.deletedAt),
          ),
        )
        .limit(1);
      if (station) {
        candidates.push(
          {
            fieldKey: "response_district",
            sectionKey: "OVERVIEW",
            value: station.defaultResponseDistrict,
            prefillSource: "TENANT_DEFAULT",
          },
          {
            fieldKey: "station_timezone",
            sectionKey: "OVERVIEW",
            value: station.timezone,
            prefillSource: "TENANT_DEFAULT",
          },
        );
      }
    }

    if (input.personnelId) {
      const [personnel] = await tx
        .select()
        .from(rmsPersonnel)
        .where(
          and(
            eq(rmsPersonnel.id, input.personnelId),
            eq(rmsPersonnel.tenantId, tenantId),
            isNull(rmsPersonnel.deletedAt),
          ),
        )
        .limit(1);
      if (personnel) {
        candidates.push({
          fieldKey: "personnel_rank",
          sectionKey: "UNITS_PERSONNEL",
          value: personnel.rank,
          prefillSource: "PERSONNEL",
        });
      }
    }

    if (input.occupancyId) {
      const [occupancy] = await tx
        .select()
        .from(rmsOccupancies)
        .where(
          and(
            eq(rmsOccupancies.id, input.occupancyId),
            eq(rmsOccupancies.tenantId, tenantId),
            isNull(rmsOccupancies.deletedAt),
          ),
        )
        .limit(1);
      if (occupancy) {
        candidates.push(
          {
            fieldKey: "location_name",
            sectionKey: "LOCATION",
            value: occupancy.name,
            prefillSource: "OCCUPANCY",
          },
          {
            fieldKey: "address_line1",
            sectionKey: "LOCATION",
            value: occupancy.addressLine1,
            prefillSource: "OCCUPANCY",
          },
        );
      }
    }

    if (input.preplanId) {
      const [preplan] = await tx
        .select()
        .from(rmsPreplans)
        .where(
          and(
            eq(rmsPreplans.id, input.preplanId),
            eq(rmsPreplans.tenantId, tenantId),
            isNull(rmsPreplans.deletedAt),
          ),
        )
        .limit(1);
      if (preplan) {
        candidates.push({
          fieldKey: "tactical_summary",
          sectionKey: "LOCATION",
          value: preplan.tacticalSummary,
          prefillSource: "PREPLAN",
        });
      }
    }

    return candidates.filter((c) => c.value !== null && c.value !== undefined && c.value !== "");
  }

  /** Never overwrite values the user has explicitly confirmed. */
  shouldApplyPrefill(existing: { userConfirmed: boolean } | null | undefined): boolean {
    return !existing?.userConfirmed;
  }

  buildFieldUpsert(
    incidentId: string,
    tenantId: string,
    fieldId: string,
    sectionKey: string,
    value: unknown,
    prefillSource: PrefillSource,
    userId?: string,
  ): typeof nerisIncidentFieldValues.$inferInsert {
    const base = {
      id: createId(),
      tenantId,
      incidentId,
      fieldId,
      sectionKey,
      prefillSource,
      userConfirmed: false,
      createdByUserId: userId,
      updatedByUserId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const;

    if (typeof value === "string") return { ...base, valueText: value };
    if (typeof value === "number") return { ...base, valueNumber: String(value) };
    if (typeof value === "boolean") return { ...base, valueBoolean: value };
    return { ...base, valueJson: value };
  }
}
