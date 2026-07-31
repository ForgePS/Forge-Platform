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
