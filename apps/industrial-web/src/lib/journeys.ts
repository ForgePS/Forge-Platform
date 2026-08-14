/**
 * Documented end-user journeys for Industrial UX Parity S1 Wave 4.
 * Browser Playwright against live Cognito is CONDITION until industrial-web-e2e lands;
 * these contracts gate route/module wiring so journeys cannot silently rot.
 */

export type JourneyStep = {
  id: string;
  action: string;
  /** Path the user must be able to open (module route or hash target). */
  route?: string;
};

export type Journey = {
  id: string;
  name: string;
  moduleCodes: string[];
  steps: JourneyStep[];
  /** Fleet is OUT_OF_SCOPE this sprint. */
  outOfScope?: boolean;
};

export const INDUSTRIAL_JOURNEYS: Journey[] = [
  {
    id: "personnel",
    name: "Personnel",
    moduleCodes: ["PERSONNEL"],
    steps: [
      { id: "open", action: "Open Personnel", route: "/modules/personnel" },
      { id: "search", action: "Search roster" },
      { id: "add", action: "Add employee", route: "/modules/personnel#ops-create" },
      { id: "photo", action: "Upload employee photo (device/camera, no URL paste)" },
      { id: "save", action: "Save employee" },
      { id: "profile", action: "Open profile tabs (Overview / Training / Certifications / Activity)" },
      { id: "verify", action: "Verify saved fields and photo preview" },
    ],
  },
  {
    id: "training",
    name: "Training",
    moduleCodes: ["TRAINING", "PERSONNEL"],
    steps: [
      { id: "open", action: "Open Training", route: "/modules/training" },
      { id: "bulk", action: "Record training for multiple employees" },
      { id: "save", action: "Save bulk records" },
      { id: "verify", action: "Verify completion chips (Upcoming / Overdue / Complete)" },
    ],
  },
  {
    id: "incidents",
    name: "Incidents",
    moduleCodes: ["INCIDENTS"],
    steps: [
      { id: "report", action: "Report incident", route: "/modules/incidents#ops-create" },
      { id: "photo", action: "Add photo on wizard step 2" },
      { id: "save", action: "Save incident" },
      { id: "open", action: "Open incident detail" },
      { id: "capa", action: "Add corrective action / next-action status" },
      { id: "verify", action: "Verify status badge and detail fields" },
    ],
  },
  {
    id: "inspections",
    name: "Inspections",
    moduleCodes: ["INSPECTIONS"],
    steps: [
      { id: "create", action: "Create inspection", route: "/modules/inspections#ops-create" },
      { id: "photo", action: "Add finding photo" },
      { id: "capa", action: "Assign corrective action note" },
      { id: "finalize", action: "Advance status / finalize next action" },
      { id: "verify", action: "Verify inspection detail" },
    ],
  },
  {
    id: "loto",
    name: "LOTO",
    moduleCodes: ["LOCKOUT_TAGOUT"],
    steps: [
      { id: "open", action: "Open LOTO workspace", route: "/modules/loto" },
      { id: "tabs", action: "Visit Dashboard / Procedures / Equipment / Reviews" },
      { id: "search", action: "Search procedures" },
      { id: "open-proc", action: "Open procedure detail" },
      { id: "verify", action: "Verify equipment, energy steps, attachments" },
    ],
  },
  {
    id: "workers-comp",
    name: "Workers Comp",
    moduleCodes: ["WORKERS_COMP"],
    steps: [
      { id: "open", action: "Open Workers Comp", route: "/modules/workers-comp" },
      { id: "find", action: "Find case (employee-first list)" },
      { id: "case", action: "Open case Overview / Claim / Notes" },
      { id: "sensitive", action: "Verify sensitive fields remain permission-gated" },
    ],
  },
  {
    id: "fleet",
    name: "Fleet",
    moduleCodes: ["FLEET"],
    outOfScope: true,
    steps: [{ id: "skip", action: "OUT_OF_SCOPE — dedicated Fleet sprint" }],
  },
  {
    id: "analytics",
    name: "Analytics",
    moduleCodes: ["ANALYTICS"],
    steps: [
      { id: "open", action: "Open Analytics", route: "/modules/analytics" },
      { id: "filters", action: "Change date / facility filters" },
      { id: "verify", action: "Verify real data panels (no fabricated KPIs)" },
    ],
  },
  {
    id: "mobile",
    name: "Mobile field",
    moduleCodes: ["INCIDENTS", "INSPECTIONS", "OBSERVATIONS", "LOCKOUT_TAGOUT"],
    steps: [
      { id: "viewport", action: "Use phone viewport (≤767px)" },
      { id: "drawer", action: "Open sidebar as drawer" },
      { id: "field-bar", action: "Use FieldQuickBar for incident/inspection/observation/LOTO" },
      { id: "filters", action: "Open FilterPanel drawer; apply chips" },
      { id: "photo", action: "Capture photo via LocalPhotoField (capture=environment)" },
      { id: "overflow", action: "Confirm no horizontal page overflow" },
    ],
  },
];

export function journeyById(id: string): Journey | undefined {
  return INDUSTRIAL_JOURNEYS.find((j) => j.id === id);
}

export function inScopeJourneys(): Journey[] {
  return INDUSTRIAL_JOURNEYS.filter((j) => !j.outOfScope);
}
