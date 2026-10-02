import { createHash } from "node:crypto";
import { z } from "zod";

export const HYDRANT_IMPORT_ADAPTER_KEY = "FORGE_RMS:HYDRANTS:hydrant@1";

const statusSchema = z.enum(["IN_SERVICE", "NEEDS_REPAIR", "OUT_OF_SERVICE", "UNKNOWN"]);

function optionalNumber(schema = z.number()) {
  return z.preprocess((value) => {
    if (value === "" || value == null) return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }, schema.optional().nullable());
}

const optionalText = z.preprocess((value) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}, z.string().optional().nullable());

export const hydrantImportRecordSchema = z.object({
  sourceHydrantId: z.string().min(1).max(255),
  displayId: z.string().min(1).max(64),
  officialHydrantId: optionalText,
  locationId: optionalText,
  district: optionalText,
  addressLine1: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  latitude: optionalNumber(z.number().min(-90).max(90)),
  longitude: optionalNumber(z.number().min(-180).max(180)),
  status: statusSchema.default("UNKNOWN"),
  waterProvider: optionalText,
  waterAssociation: optionalText,
  subdivision: optionalText,
  dischargeSize: optionalNumber(z.number().positive()),
  hydrantType: optionalText,
  manufacturer: optionalText,
  model: optionalText,
  installDate: optionalText,
  lastInspectionDate: optionalText,
  lastFlowTestDate: optionalText,
  flowGpm: optionalNumber(z.number().nonnegative()),
  staticPsi: optionalNumber(z.number().nonnegative()),
  residualPsi: optionalNumber(z.number().nonnegative()),
  nfpaClass: optionalText,
  nfpaColor: optionalText,
  issue: optionalText,
  alternateSupply: optionalText,
  notes: optionalText,
  flowTests: z.array(z.record(z.string(), z.unknown())).default([]),
  inspections: z.array(z.record(z.string(), z.unknown())).default([]),
  damageReports: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type HydrantImportRecord = z.infer<typeof hydrantImportRecordSchema>;

const aliases: Record<string, string[]> = {
  sourceHydrantId: ["sourceHydrantId","source_hydrant_id","id","hydrantId","hydrant_id","legacyId","legacy_id"],
  displayId: ["displayId","display_id","hydrantNumber","hydrant_number","hydrantNo","hydrant_no","name"],
  officialHydrantId: ["officialHydrantId","official_hydrant_id","officialId","official_id"],
  locationId: ["locationId","location_id"],
  district: ["district","responseDistrict","response_district"],
  addressLine1: ["addressLine1","address_line_1","address","streetAddress","street_address"],
  city: ["city"],
  state: ["state"],
  postalCode: ["postalCode","postal_code","zip","zipCode","zip_code"],
  latitude: ["latitude","lat"],
  longitude: ["longitude","lng","lon","long"],
  status: ["status","operationalStatus","operational_status","serviceStatus","service_status"],
  waterProvider: ["waterProvider","water_provider","provider"],
  waterAssociation: ["waterAssociation","water_association"],
  subdivision: ["subdivision"],
  dischargeSize: ["dischargeSize","discharge_size","outletSize","outlet_size"],
  hydrantType: ["hydrantType","hydrant_type","type"],
  manufacturer: ["manufacturer","make"],
  model: ["model"],
  installDate: ["installDate","install_date"],
  lastInspectionDate: ["lastInspectionDate","last_inspection_date"],
  lastFlowTestDate: ["lastFlowTestDate","last_flow_test_date"],
  flowGpm: ["flowGpm","flow_gpm","gpm","flow"],
  staticPsi: ["staticPsi","static_psi","staticPressure","static_pressure"],
  residualPsi: ["residualPsi","residual_psi","residualPressure","residual_pressure"],
  nfpaClass: ["nfpaClass","nfpa_class","flowClass","flow_class"],
  nfpaColor: ["nfpaColor","nfpa_color","flowColor","flow_color"],
  issue: ["issue","currentIssue","current_issue"],
  alternateSupply: ["alternateSupply","alternate_supply","alternateWaterSupply","alternate_water_supply"],
  notes: ["notes","note","comments"],
  flowTests: ["flowTests","flow_tests","tests","flowTestHistory","flow_test_history"],
  inspections: ["inspections","inspectionHistory","inspection_history"],
  damageReports: ["damageReports","damage_reports","damageHistory","damage_history"],
};

function first(input: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) if (input[key] !== undefined) return input[key];
  return undefined;
}

function normalizeStatus(value: unknown): "IN_SERVICE" | "NEEDS_REPAIR" | "OUT_OF_SERVICE" | "UNKNOWN" {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[ -]+/g, "_");
  if (["ACTIVE","AVAILABLE","INSERVICE","IN_SERVICE","PASS"].includes(normalized)) return "IN_SERVICE";
  if (["NEEDS_REPAIR","REPAIR","DEFICIENT","WARNING"].includes(normalized)) return "NEEDS_REPAIR";
  if (["OUT_OF_SERVICE","OUTOFSERVICE","OOS","FAILED","FAIL"].includes(normalized)) return "OUT_OF_SERVICE";
  return "UNKNOWN";
}

export type HydrantImportIssue = {
  severity: "ERROR" | "WARNING";
  code: string;
  field?: string;
  message: string;
};

export type HydrantImportNormalization = {
  sourceRowKey: string;
  sourceHash: string;
  mapped: HydrantImportRecord | null;
  issues: HydrantImportIssue[];
  classification: "READY" | "INVALID";
};

export function normalizeHydrantImportRecord(
  raw: Record<string, unknown>,
  rowIndex = 0,
): HydrantImportNormalization {
  const candidate: Record<string, unknown> = {};
  for (const [target, keys] of Object.entries(aliases)) candidate[target] = first(raw, keys);
  candidate.sourceHydrantId = candidate.sourceHydrantId ?? candidate.displayId ?? `row-${rowIndex + 1}`;
  candidate.displayId = candidate.displayId ?? candidate.sourceHydrantId;
  candidate.status = normalizeStatus(candidate.status);
  for (const key of ["flowTests","inspections","damageReports"]) {
    if (!Array.isArray(candidate[key])) candidate[key] = [];
  }

  const parsed = hydrantImportRecordSchema.safeParse(candidate);
  const sourceHash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  const sourceRowKey = String(candidate.sourceHydrantId || `row-${rowIndex + 1}`);
  if (!parsed.success) {
    return {
      sourceRowKey,
      sourceHash,
      mapped: null,
      classification: "INVALID",
      issues: parsed.error.issues.map((issue) => ({
        severity: "ERROR",
        code: "HYDRANT_IMPORT_INVALID_FIELD",
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const issues: HydrantImportIssue[] = [];
  if ((parsed.data.latitude == null) !== (parsed.data.longitude == null)) {
    issues.push({severity:"ERROR",code:"HYDRANT_IMPORT_PARTIAL_COORDINATES",field:"latitude/longitude",message:"Latitude and longitude must both be supplied or both be empty."});
  }
  if (!parsed.data.addressLine1 && parsed.data.latitude == null) {
    issues.push({severity:"WARNING",code:"HYDRANT_IMPORT_NO_LOCATION",field:"addressLine1",message:"Hydrant has neither a street address nor coordinates."});
  }
  if (parsed.data.status === "UNKNOWN") {
    issues.push({severity:"WARNING",code:"HYDRANT_IMPORT_UNKNOWN_STATUS",field:"status",message:"Source status could not be mapped to a known operational state."});
  }

  return {
    sourceRowKey,
    sourceHash,
    mapped: parsed.data,
    issues,
    classification: issues.some((issue) => issue.severity === "ERROR") ? "INVALID" : "READY",
  };
}

export type ExistingHydrantIdentity = {
  id: string;
  displayId: string;
  officialHydrantId?: string | null;
  locationId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type HydrantDuplicateDecision = {
  classification: "READY" | "DUPLICATE" | "AMBIGUOUS";
  existingId?: string;
  reason?: string;
  candidateIds?: string[];
};

export function classifyHydrantDuplicate(
  incoming: HydrantImportRecord,
  existing: ExistingHydrantIdentity[],
): HydrantDuplicateDecision {
  const exact = existing.filter((row) =>
    row.displayId.toLowerCase() === incoming.displayId.toLowerCase() ||
    (!!incoming.officialHydrantId && row.officialHydrantId === incoming.officialHydrantId) ||
    (!!incoming.locationId && row.locationId === incoming.locationId),
  );
  const unique = [...new Map(exact.map((row) => [row.id, row])).values()];
  if (unique.length === 1) return {classification:"DUPLICATE",existingId:unique[0]!.id,reason:"Exact display, official, or location identifier match."};
  if (unique.length > 1) return {classification:"AMBIGUOUS",candidateIds:unique.map((row)=>row.id),reason:"Source identifiers match multiple existing hydrants."};

  if (incoming.latitude != null && incoming.longitude != null) {
    const near = existing.filter((row) => row.latitude != null && row.longitude != null && feetBetween(incoming.latitude!, incoming.longitude!, row.latitude!, row.longitude!) <= 25);
    if (near.length === 1) return {classification:"DUPLICATE",existingId:near[0]!.id,reason:"Existing hydrant is within 25 feet of imported coordinates."};
    if (near.length > 1) return {classification:"AMBIGUOUS",candidateIds:near.map((row)=>row.id),reason:"Multiple existing hydrants are within 25 feet of imported coordinates."};
  }
  return {classification:"READY"};
}

function feetBetween(aLat:number,aLon:number,bLat:number,bLon:number):number {
  const rad=(value:number)=>value*Math.PI/180;
  const earthFeet=20902231;
  const dLat=rad(bLat-aLat);
  const dLon=rad(bLon-aLon);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
  return Math.round(2*earthFeet*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)));
}

export function buildHydrantImportReconciliation(
  normalized: HydrantImportNormalization[],
  existing: ExistingHydrantIdentity[],
) {
  const rows = normalized.map((row) => {
    if (!row.mapped || row.classification === "INVALID") return {...row,duplicate:{classification:"READY" as const}};
    return {...row,duplicate:classifyHydrantDuplicate(row.mapped,existing)};
  });
  return {
    total: rows.length,
    ready: rows.filter((row)=>row.classification==="READY"&&row.duplicate.classification==="READY").length,
    invalid: rows.filter((row)=>row.classification==="INVALID").length,
    duplicates: rows.filter((row)=>row.duplicate.classification==="DUPLICATE").length,
    ambiguous: rows.filter((row)=>row.duplicate.classification==="AMBIGUOUS").length,
    warnings: rows.reduce((sum,row)=>sum+row.issues.filter((issue)=>issue.severity==="WARNING").length,0),
    rows,
  };
}
