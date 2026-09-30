/**
 * Product-neutral import template metadata for S2.
 * Does not generate CSV/XLSX files.
 */

export type ImportTemplateField = {
  fieldKey: string;
  displayName: string;
  dataType: "string" | "number" | "boolean" | "date" | "uuid";
  required: boolean;
  sensitive: boolean;
};

export type ImportTemplateMeta = {
  templateKey: string;
  displayName: string;
  description: string;
  productKey: string;
  moduleKey: string;
  recordCategory: string;
  supportedSourceTypes: Array<"csv" | "xlsx" | "json" | "zip" | "api" | "manual">;
  fields: ImportTemplateField[];
  schemaVersion: number;
};

export const IMPORT_TEMPLATES: readonly ImportTemplateMeta[] = [
  {
    templateKey: "generic.records.v1",
    displayName: "Generic records import",
    description: "Product-neutral control-plane template for shared import jobs.",
    productKey: "FORGE_RMS",
    moduleKey: "CORE",
    recordCategory: "generic_record",
    supportedSourceTypes: ["csv", "xlsx", "json", "manual"],
    schemaVersion: 1,
    fields: [
      {
        fieldKey: "external_id",
        displayName: "External ID",
        dataType: "string",
        required: true,
        sensitive: false,
      },
      {
        fieldKey: "display_name",
        displayName: "Display name",
        dataType: "string",
        required: true,
        sensitive: false,
      },
      {
        fieldKey: "notes",
        displayName: "Notes",
        dataType: "string",
        required: false,
        sensitive: false,
      },
    ],
  },
  {
    templateKey: "generic.personnel.stub.v1",
    displayName: "Generic personnel stub",
    description: "Neutral personnel-shaped fields without product-specific adapters.",
    productKey: "FORGE_RMS",
    moduleKey: "PERSONNEL",
    recordCategory: "personnel_stub",
    supportedSourceTypes: ["csv", "xlsx", "manual"],
    schemaVersion: 1,
    fields: [
      {
        fieldKey: "employee_number",
        displayName: "Employee number",
        dataType: "string",
        required: true,
        sensitive: false,
      },
      {
        fieldKey: "full_name",
        displayName: "Full name",
        dataType: "string",
        required: true,
        sensitive: false,
      },
      {
        fieldKey: "work_email",
        displayName: "Work email",
        dataType: "string",
        required: false,
        sensitive: true,
      },
    ],
  },
  {
    templateKey: "rms.hydrants.v1",
    displayName: "Forge Responder hydrants",
    description: "Hydrant master-data migration template for Forge Responder, Firestore exports, CSV/XLSX, and JSON migration bundles.",
    productKey: "FORGE_RMS",
    moduleKey: "HYDRANTS",
    recordCategory: "hydrant",
    supportedSourceTypes: ["csv", "xlsx", "json", "zip", "api", "manual"],
    schemaVersion: 1,
    fields: [
      { fieldKey: "source_hydrant_id", displayName: "Source Hydrant ID", dataType: "string", required: true, sensitive: false },
      { fieldKey: "display_id", displayName: "Display ID", dataType: "string", required: true, sensitive: false },
      { fieldKey: "official_hydrant_id", displayName: "Official Hydrant ID", dataType: "string", required: false, sensitive: false },
      { fieldKey: "location_id", displayName: "Location ID", dataType: "string", required: false, sensitive: false },
      { fieldKey: "district", displayName: "District", dataType: "string", required: false, sensitive: false },
      { fieldKey: "address_line_1", displayName: "Street Address", dataType: "string", required: false, sensitive: false },
      { fieldKey: "city", displayName: "City", dataType: "string", required: false, sensitive: false },
      { fieldKey: "state", displayName: "State", dataType: "string", required: false, sensitive: false },
      { fieldKey: "postal_code", displayName: "Postal Code", dataType: "string", required: false, sensitive: false },
      { fieldKey: "latitude", displayName: "Latitude", dataType: "number", required: false, sensitive: false },
      { fieldKey: "longitude", displayName: "Longitude", dataType: "number", required: false, sensitive: false },
      { fieldKey: "status", displayName: "Operational Status", dataType: "string", required: false, sensitive: false },
      { fieldKey: "water_provider", displayName: "Water Provider", dataType: "string", required: false, sensitive: false },
      { fieldKey: "water_association", displayName: "Water Association", dataType: "string", required: false, sensitive: false },
      { fieldKey: "subdivision", displayName: "Subdivision", dataType: "string", required: false, sensitive: false },
      { fieldKey: "discharge_size", displayName: "Discharge Size", dataType: "number", required: false, sensitive: false },
      { fieldKey: "hydrant_type", displayName: "Hydrant Type", dataType: "string", required: false, sensitive: false },
      { fieldKey: "manufacturer", displayName: "Manufacturer", dataType: "string", required: false, sensitive: false },
      { fieldKey: "model", displayName: "Model", dataType: "string", required: false, sensitive: false },
      { fieldKey: "install_date", displayName: "Install Date", dataType: "date", required: false, sensitive: false },
      { fieldKey: "flow_gpm", displayName: "Latest Flow GPM", dataType: "number", required: false, sensitive: false },
      { fieldKey: "static_psi", displayName: "Latest Static PSI", dataType: "number", required: false, sensitive: false },
      { fieldKey: "residual_psi", displayName: "Latest Residual PSI", dataType: "number", required: false, sensitive: false },
      { fieldKey: "nfpa_class", displayName: "NFPA Class", dataType: "string", required: false, sensitive: false },
      { fieldKey: "nfpa_color", displayName: "NFPA Color", dataType: "string", required: false, sensitive: false },
      { fieldKey: "notes", displayName: "Notes", dataType: "string", required: false, sensitive: false }
    ],
  },
] as const;

export function listImportTemplates(filters?: {
  productKey?: string;
  moduleKey?: string;
  recordCategory?: string;
}): ImportTemplateMeta[] {
  return IMPORT_TEMPLATES.filter((t) => {
    if (filters?.productKey && t.productKey !== filters.productKey) return false;
    if (filters?.moduleKey && t.moduleKey !== filters.moduleKey) return false;
    if (filters?.recordCategory && t.recordCategory !== filters.recordCategory) return false;
    return true;
  }).map((t) => ({ ...t, fields: t.fields.map((f) => ({ ...f })) }));
}

export function getImportTemplate(templateKey: string): ImportTemplateMeta | undefined {
  const found = IMPORT_TEMPLATES.find((t) => t.templateKey === templateKey);
  return found ? { ...found, fields: found.fields.map((f) => ({ ...f })) } : undefined;
}
