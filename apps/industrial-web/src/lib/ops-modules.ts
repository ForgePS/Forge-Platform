/** IND-3 core operations modules with AWS workspace UIs. */
export const IND3_OPS_MODULES = [
  "personnel",
  "training",
  "forms",
  "inspections",
  "incidents",
  "jsas",
  "observations",
] as const;

export type Ind3OpsModule = (typeof IND3_OPS_MODULES)[number];

export function isInd3OpsModule(module: string): module is Ind3OpsModule {
  return (IND3_OPS_MODULES as readonly string[]).includes(module);
}

export const OPS_MODULE_CONFIG: Record<
  Ind3OpsModule,
  {
    code: string;
    flagKey: string;
    viewPerm: string;
    managePerm: string;
    listPath: string;
    createPath: string;
    titleField: string;
    createFields: Array<{
      name: string;
      label: string;
      required?: boolean;
      type?: string;
      placeholder?: string;
      /** 1 = Basics, 2 = Details (wizard modules only). */
      wizardStep?: 1 | 2;
    }>;
  }
> = {
  personnel: {
    code: "PERSONNEL",
    flagKey: "industrial.module.personnel.enabled",
    viewPerm: "industrial.personnel.view",
    managePerm: "industrial.personnel.manage",
    listPath: "/api/v1/industrial/personnel",
    createPath: "/api/v1/industrial/personnel",
    titleField: "displayName",
    createFields: [
      { name: "firstName", label: "First name", required: true },
      { name: "lastName", label: "Last name", required: true },
      { name: "employeeNumber", label: "Employee number" },
      { name: "email", label: "Email", type: "email" },
      { name: "jobTitle", label: "Job title" },
      { name: "department", label: "Department" },
    ],
  },
  training: {
    code: "TRAINING",
    flagKey: "industrial.module.training.enabled",
    viewPerm: "industrial.training.view",
    managePerm: "industrial.training.manage",
    listPath: "/api/v1/industrial/training",
    createPath: "/api/v1/industrial/training",
    titleField: "title",
    createFields: [
      { name: "title", label: "Training title", required: true },
      { name: "courseCode", label: "Course code" },
      { name: "instructorName", label: "Instructor" },
      { name: "assigneeName", label: "Assignee" },
      { name: "dueDate", label: "Due date", type: "date" },
      {
        name: "completionStatus",
        label: "Completion status",
        placeholder: "Upcoming / Overdue / Complete",
      },
      { name: "notes", label: "Notes" },
    ],
  },
  forms: {
    code: "FORMS",
    flagKey: "industrial.module.forms.enabled",
    viewPerm: "industrial.forms.view",
    managePerm: "industrial.forms.manage",
    listPath: "/api/v1/industrial/forms",
    createPath: "/api/v1/industrial/forms",
    titleField: "name",
    createFields: [
      { name: "name", label: "Form name", required: true },
      { name: "category", label: "Category" },
    ],
  },
  inspections: {
    code: "INSPECTIONS",
    flagKey: "industrial.module.inspections.enabled",
    viewPerm: "industrial.inspections.view",
    managePerm: "industrial.inspections.manage",
    listPath: "/api/v1/industrial/inspections",
    createPath: "/api/v1/industrial/inspections",
    titleField: "title",
    createFields: [
      { name: "title", label: "Inspection title", required: true, wizardStep: 1 },
      { name: "inspectionDate", label: "Inspection date", type: "date", wizardStep: 1 },
      { name: "templateName", label: "Template", wizardStep: 1 },
      { name: "facilityName", label: "Facility", wizardStep: 1 },
      { name: "auditorName", label: "Auditor", wizardStep: 1 },
      {
        name: "sectionResults",
        label: "Section results",
        placeholder: "Summarize section findings…",
        wizardStep: 2,
      },
      { name: "comments", label: "Comments", wizardStep: 2 },
      { name: "correctiveAction", label: "Corrective action", wizardStep: 2 },
    ],
  },
  incidents: {
    code: "INCIDENTS",
    flagKey: "industrial.module.incidents.enabled",
    viewPerm: "industrial.incidents.view",
    managePerm: "industrial.incidents.manage",
    listPath: "/api/v1/industrial/incidents",
    createPath: "/api/v1/industrial/incidents",
    titleField: "title",
    createFields: [
      { name: "title", label: "Incident title", required: true, wizardStep: 1 },
      { name: "category", label: "Category", wizardStep: 1 },
      { name: "severity", label: "Severity", wizardStep: 1 },
      { name: "location", label: "Location", wizardStep: 1 },
      { name: "occurredAt", label: "Occurred at", type: "datetime-local", wizardStep: 1 },
      { name: "classification", label: "Classification", wizardStep: 1 },
      { name: "peopleInvolved", label: "People involved", wizardStep: 2 },
      { name: "description", label: "Description", wizardStep: 2 },
      { name: "narrative", label: "Narrative", wizardStep: 2 },
      { name: "immediateActions", label: "Immediate actions", wizardStep: 2 },
      { name: "correctiveActions", label: "Corrective actions", wizardStep: 2 },
    ],
  },
  jsas: {
    code: "JSAS",
    flagKey: "industrial.module.jsa.enabled",
    viewPerm: "industrial.jsa.view",
    managePerm: "industrial.jsa.manage",
    listPath: "/api/v1/industrial/jsas",
    createPath: "/api/v1/industrial/jsas",
    titleField: "title",
    createFields: [
      { name: "title", label: "JSA title", required: true },
      { name: "task", label: "Task" },
      { name: "location", label: "Location" },
    ],
  },
  observations: {
    code: "OBSERVATIONS",
    flagKey: "industrial.module.observations.enabled",
    viewPerm: "industrial.observations.view",
    managePerm: "industrial.observations.manage",
    listPath: "/api/v1/industrial/observations",
    createPath: "/api/v1/industrial/observations",
    titleField: "description",
    createFields: [
      { name: "description", label: "Description", required: true },
      { name: "observationType", label: "Type" },
      { name: "category", label: "Category" },
      { name: "location", label: "Location" },
      { name: "riskLevel", label: "Risk level" },
    ],
  },
};
