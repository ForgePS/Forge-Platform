import {
  apiGet,
  apiGetResult,
  apiSend,
  apiSendResult,
  createIdempotencyKey,
  toIfMatch,
  type ApiResult,
} from "@forge/web-kit";

export type IncidentSummary = {
  id: string;
  incidentNumber: string;
  status: string;
  incidentDate: string | null;
  dispatchDescription: string | null;
  primaryIncidentTypeCode: string | null;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type IncidentDetail = IncidentSummary & {
  alarmAt: string | null;
  stationId: string | null;
  shiftId: string | null;
  responseDistrict: string | null;
  incidentSource: string | null;
  mutualAidStatus: string | null;
  aidDirection: string | null;
  operatingMode: string;
  reportOwnerUserId?: string | null;
  sections: Array<{ sectionKey: string; status: string; recordVersion: number }>;
};

export type FormDescriptorField = {
  fieldId: string;
  fieldKey: string;
  definition: string;
  dataType: string | null;
  required: boolean;
  displayLabel: string;
  helpText?: string | null;
  localAlias?: string | null;
  displayOrder: number;
  visible: boolean;
  valueSetLocation?: string | null;
  valueOverlays?: unknown[];
};

export type FormDescriptorModule = {
  moduleKey: string;
  name: string;
  area: string | null;
  sectionKey: string;
  specialtyGroupId?: string | null;
  visible: boolean;
  fields: FormDescriptorField[];
};

export type SpecialtyWorkflowGroup = {
  id: string;
  sectionKey: string;
  label: string;
  plainLanguageSummary: string;
  state: "HIDDEN" | "OPTIONAL" | "REQUIRED" | "ACTIVE" | "NOT_APPLICABLE";
  required: boolean;
  allowNotApplicable: boolean;
  activationReasons: string[];
  moduleKeys: string[];
  presentModuleKeys: string[];
  repeatableHints: string[];
  fieldCount?: number;
  requiredFieldCount?: number;
  filledRequiredFieldCount?: number;
  completionPercent?: number;
  hasBlockingGaps?: boolean;
};

export type AvailableSpecialtySection = {
  sectionKey: string;
  label: string;
  summary: string;
};

export type FormDescriptor = {
  schemaVersionId: string | null;
  operatingMode: string;
  sections: string[];
  navigationSections?: string[];
  specialtyWorkflows?: SpecialtyWorkflowGroup[];
  availableSpecialtySections?: AvailableSpecialtySection[];
  modules: FormDescriptorModule[];
};

export type NarrativePayload = {
  id: string;
  body: string;
  templateKey: string | null;
  recordVersion: number;
  updatedAt: string;
};

export type ValidationIssue = {
  severity: string;
  code: string;
  message: string;
  sectionKey?: string | null;
  fieldId?: string | null;
  technicalReference?: string | null;
};

export type StatusHistoryRow = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  createdAt: string;
};

export type AuditEventRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: string;
  occurredAt: string;
  beforeJson?: unknown;
  afterJson?: unknown;
};

export type ValidationRun = {
  id: string;
  status: string;
  createdAt: string;
  results?: ValidationIssue[];
};

export type ReviewComment = {
  id: string;
  sectionKey: string | null;
  fieldId: string | null;
  specialtyRecordType?: string | null;
  specialtyRecordId?: string | null;
  attachmentId?: string | null;
  validationResultId?: string | null;
  reviewerRole?: string | null;
  assignedToUserId?: string | null;
  status?: string;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  body: string;
  authorUserId: string;
  createdAt: string;
};

export type ReviewCommentInput = {
  body: string;
  sectionKey?: string | null;
  fieldId?: string | null;
  specialtyRecordType?: string | null;
  specialtyRecordId?: string | null;
  attachmentId?: string | null;
  validationResultId?: string | null;
  reviewerRole?: string | null;
  assignedToUserId?: string | null;
};

export type LookupRow = {
  id: string;
  label: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
};

export type UnitDetail = {
  id: string;
  unitNumber: string;
  callSign: string;
  unitType: string;
  apparatusId: string | null;
  stationId: string | null;
  status: string;
  recordVersion: number;
};

export type ApparatusDetail = {
  id: string;
  apparatusNumber: string;
  name: string;
  apparatusType: string;
  stationId: string | null;
  nerisClassification: string | null;
  status: string;
  recordVersion: number;
  createdAt?: string;
  updatedAt?: string;
};

export type OccupancyDetail = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryContact: string | null;
  occupancyType: string | null;
  preplanId: string | null;
  status: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type RosterDetail = {
  id: string;
  rosterDate: string;
  shiftId: string;
  stationId: string;
  status: string;
  assignments: Array<{
    id: string;
    personnelId: string;
    unitId: string | null;
    assignmentRole: string;
    isOfficer: boolean;
    incidentCommanderEligible: boolean;
  }>;
};

export type IncidentUnitAssignment = {
  id: string;
  unitId: string;
  isPrimary: boolean;
  unitRole: string | null;
  recordVersion: number;
};

export type IncidentPersonnelAssignment = {
  id: string;
  personnelId: string;
  unitAssignmentId: string | null;
  role: string | null;
  recordVersion: number;
};

export type PrefillCandidate = {
  fieldKey: string;
  sectionKey: string;
  value: unknown;
  prefillSource: string;
};

type MasterDataKind = "personnel" | "units" | "apparatus" | "occupancies" | "stations" | "shifts";

function tenantBase(tenantId: string): string {
  return `/api/v1/tenants/${tenantId}`;
}

export function listIncidents(
  tenantId: string,
  query: Record<string, string>,
): Promise<ApiResult<IncidentSummary[]>> {
  return apiGetResult<IncidentSummary[]>(`${tenantBase(tenantId)}/neris/incidents`, { query });
}

export function getIncident(tenantId: string, incidentId: string): Promise<ApiResult<IncidentDetail>> {
  return apiGetResult<IncidentDetail>(`${tenantBase(tenantId)}/neris/incidents/${incidentId}`);
}

export function createIncident(
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<IncidentDetail>> {
  return apiSendResult<IncidentDetail>(`${tenantBase(tenantId)}/neris/incidents`, "POST", payload, {
    idempotencyKey: createIdempotencyKey("incident"),
  });
}

export function patchIncident(
  tenantId: string,
  incidentId: string,
  payload: Record<string, unknown>,
  recordVersion: number,
): Promise<ApiResult<IncidentDetail>> {
  return apiSendResult<IncidentDetail>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}`,
    "PATCH",
    payload,
    { ifMatch: toIfMatch(recordVersion) },
  );
}

export function batchFieldValues(
  tenantId: string,
  incidentId: string,
  values: Array<Record<string, unknown>>,
  recordVersion: number,
): Promise<ApiResult<{ incident: IncidentDetail; upserted: number }>> {
  return apiSendResult<{ incident: IncidentDetail; upserted: number }>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/field-values`,
    "PATCH",
    { values },
    { ifMatch: toIfMatch(recordVersion) },
  );
}

export function getFormDescriptor(tenantId: string, incidentId: string): Promise<FormDescriptor> {
  return apiGet<FormDescriptor>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/form-descriptor`,
  );
}

export async function postSpecialtySection(
  tenantId: string,
  incidentId: string,
  sectionKey: string,
  action: "ACTIVATE" | "MARK_NOT_APPLICABLE" | "CLEAR_NOT_APPLICABLE",
): Promise<{ incidentId: string; sectionKey: string; status: string }> {
  return apiSend<{ incidentId: string; sectionKey: string; status: string }>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/specialty-sections`,
    "POST",
    { sectionKey, action },
  );
}

export function getNarrative(tenantId: string, incidentId: string): Promise<NarrativePayload | null> {
  return apiGet<NarrativePayload | null>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/narrative`,
  );
}

export function upsertNarrative(
  tenantId: string,
  incidentId: string,
  body: string,
  recordVersion: number,
  versionNote?: string,
): Promise<ApiResult<NarrativePayload>> {
  return apiSendResult<NarrativePayload>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/narrative`,
    "PATCH",
    { body, versionNote: versionNote ?? null },
    { ifMatch: toIfMatch(recordVersion) },
  );
}

export type ValidationResult = {
  runId: string;
  ok: boolean;
  findings: ValidationIssue[];
  blockingErrorCount: number;
  warningCount: number;
  guidanceCount: number;
};

export function validateIncident(tenantId: string, incidentId: string): Promise<ValidationResult> {
  return apiSend<ValidationResult>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/validate`,
    "POST",
  );
}

export function submitForReview(
  tenantId: string,
  incidentId: string,
  note?: string,
): Promise<IncidentDetail> {
  return apiSend<IncidentDetail>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/submit-for-review`,
    "POST",
    { note: note ?? null },
  );
}

export function returnIncident(
  tenantId: string,
  incidentId: string,
  reason: string,
  comments: Array<{ sectionKey?: string; fieldId?: string; body: string }>,
): Promise<IncidentDetail> {
  return apiSend<IncidentDetail>(`${tenantBase(tenantId)}/neris/incidents/${incidentId}/return`, "POST", {
    reason,
    comments,
  });
}

export function approveIncident(tenantId: string, incidentId: string): Promise<IncidentDetail> {
  return apiSend<IncidentDetail>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/approve`,
    "POST",
  );
}

export function listReviewComments(tenantId: string, incidentId: string): Promise<ReviewComment[]> {
  return apiGet<ReviewComment[]>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/review-comments`,
  );
}

export function listStatusHistory(
  tenantId: string,
  incidentId: string,
): Promise<StatusHistoryRow[]> {
  return apiGet<StatusHistoryRow[]>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/status-history`,
  );
}

export function listAuditEvents(
  tenantId: string,
  page = 1,
  pageSize = 100,
): Promise<AuditEventRow[]> {
  return apiGet<AuditEventRow[]>(
    `${tenantBase(tenantId)}/audit-events?page=${page}&pageSize=${pageSize}`,
  );
}

export function addReviewComment(
  tenantId: string,
  incidentId: string,
  bodyOrInput: string | ReviewCommentInput,
  sectionKey?: string,
  fieldId?: string,
): Promise<ReviewComment> {
  const payload: ReviewCommentInput =
    typeof bodyOrInput === "string"
      ? { body: bodyOrInput, sectionKey: sectionKey ?? null, fieldId: fieldId ?? null }
      : bodyOrInput;
  return apiSend<ReviewComment>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/review-comments`,
    "POST",
    payload,
  );
}

export function resolveReviewComment(
  tenantId: string,
  incidentId: string,
  commentId: string,
  resolutionNote?: string,
): Promise<ReviewComment> {
  return apiSend<ReviewComment>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/review-comments/${commentId}/resolve`,
    "POST",
    { resolutionNote: resolutionNote ?? null },
  );
}

export function reopenReviewComment(
  tenantId: string,
  incidentId: string,
  commentId: string,
  note?: string,
): Promise<ReviewComment> {
  return apiSend<ReviewComment>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/review-comments/${commentId}/reopen`,
    "POST",
    { note: note ?? null },
  );
}

export function approveSpecialtySection(
  tenantId: string,
  incidentId: string,
  sectionKey: string,
  reviewerRole?: string,
  note?: string,
): Promise<unknown> {
  return apiSend(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/section-approvals`,
    "POST",
    { sectionKey, reviewerRole: reviewerRole ?? null, note: note ?? null },
  );
}

export function returnSpecialtySection(
  tenantId: string,
  incidentId: string,
  input: {
    sectionKey: string;
    reason: string;
    specialtyRecordType?: string | null;
    specialtyRecordId?: string | null;
    reviewerRole?: string | null;
  },
): Promise<unknown> {
  return apiSend(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/section-returns`,
    "POST",
    input,
  );
}

export function listValidationRuns(tenantId: string, incidentId: string): Promise<ValidationRun[]> {
  return apiGet<ValidationRun[]>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/validation-runs`,
  );
}

export type TenantNerisConfiguration = {
  id: string;
  tenantId: string;
  schemaVersionId: string | null;
  operatingMode: string;
  status: string;
  recordVersion: number;
};

export type FieldOverlay = {
  id: string;
  fieldId: string;
  displayLabel: string | null;
  helpText: string | null;
  localAlias: string | null;
  displayOrder: number | null;
  favorite: boolean;
  optionalVisible: boolean | null;
  safeDefaultJson: unknown;
  localValidationJson: unknown;
};

export function getTenantNerisConfiguration(tenantId: string): Promise<TenantNerisConfiguration | null> {
  return apiGet<TenantNerisConfiguration | null>(`${tenantBase(tenantId)}/neris/configuration`);
}

export function putTenantNerisConfiguration(
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<TenantNerisConfiguration> {
  return apiSend<TenantNerisConfiguration>(`${tenantBase(tenantId)}/neris/configuration`, "PUT", payload);
}

export function listFieldOverlays(tenantId: string): Promise<FieldOverlay[]> {
  return apiGet<FieldOverlay[]>(`${tenantBase(tenantId)}/neris/field-overlays`);
}

export function putFieldOverlay(
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<FieldOverlay> {
  return apiSend<FieldOverlay>(`${tenantBase(tenantId)}/neris/field-overlays`, "PUT", payload);
}

function isActiveRecord(row: Record<string, unknown>): boolean {
  const status = row.status;
  return status === undefined || status === "ACTIVE";
}

export async function lookupMasterData(
  tenantId: string,
  kind: MasterDataKind,
  search: string,
  filters?: { stationId?: string; shiftId?: string; activeOnly?: boolean },
): Promise<LookupRow[]> {
  const path = `${tenantBase(tenantId)}/rms/${kind}`;
  const rows = await apiGet<Array<Record<string, unknown>>>(path, {
    query: { page: "1", pageSize: "50", search: search || undefined },
  });
  const activeOnly = filters?.activeOnly !== false;
  return rows
    .filter((row) => (activeOnly ? isActiveRecord(row) : true))
    .filter((row) => (filters?.stationId ? row.stationId === filters.stationId : true))
    .filter((row) => (filters?.shiftId ? row.shiftId === filters.shiftId : true))
    .map((row) => mapLookupRow(kind, row));
}

function mapLookupRow(kind: string, row: Record<string, unknown>): LookupRow {
  switch (kind) {
    case "personnel":
      return {
        id: String(row.id),
        label: String(row.rank ?? row.personId ?? row.id),
        subtitle: String(row.qualificationSummary ?? ""),
        meta: row,
      };
    case "units":
      return {
        id: String(row.id),
        label: String(row.callSign ?? row.unitNumber ?? row.id),
        subtitle: String(row.unitType ?? ""),
        meta: row,
      };
    case "apparatus":
      return {
        id: String(row.id),
        label: String(row.name ?? row.apparatusNumber ?? row.id),
        subtitle: String(row.apparatusType ?? ""),
        meta: row,
      };
    case "occupancies":
      return {
        id: String(row.id),
        label: String(row.name ?? row.id),
        subtitle: [row.addressLine1, row.city, row.state].filter(Boolean).join(", "),
        meta: row,
      };
    case "stations":
      return {
        id: String(row.id),
        label: String(row.name ?? row.stationNumber ?? row.id),
        subtitle: [row.stationNumber, row.city].filter(Boolean).join(" · "),
        meta: row,
      };
    case "shifts":
      return {
        id: String(row.id),
        label: String(row.name ?? row.code ?? row.id),
        subtitle: String(row.code ?? ""),
        meta: row,
      };
    default:
      return { id: String(row.id), label: String(row.id), meta: row };
  }
}

export function getPersonnelDetail(tenantId: string, personnelId: string): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>(`${tenantBase(tenantId)}/rms/personnel/${personnelId}`);
}

export function getUnitDetail(tenantId: string, unitId: string): Promise<UnitDetail> {
  return apiGet<UnitDetail>(`${tenantBase(tenantId)}/rms/units/${unitId}`);
}

export function getApparatusDetail(tenantId: string, apparatusId: string): Promise<ApparatusDetail> {
  return apiGet<ApparatusDetail>(`${tenantBase(tenantId)}/rms/apparatus/${apparatusId}`);
}

export function getOccupancyDetail(tenantId: string, occupancyId: string): Promise<OccupancyDetail> {
  return apiGet<OccupancyDetail>(`${tenantBase(tenantId)}/rms/occupancies/${occupancyId}`);
}

export async function findDailyRoster(
  tenantId: string,
  input: { stationId: string; shiftId: string; rosterDate: string },
): Promise<RosterDetail | null> {
  const rows = await apiGet<Array<Record<string, unknown>>>(`${tenantBase(tenantId)}/rms/rosters`, {
    query: { page: "1", pageSize: "25" },
  });
  const match = rows.find(
    (row) =>
      row.stationId === input.stationId &&
      row.shiftId === input.shiftId &&
      row.rosterDate === input.rosterDate &&
      row.status === "ACTIVE",
  );
  if (!match) return null;
  return getRosterDetail(tenantId, String(match.id));
}

export function getRosterDetail(tenantId: string, rosterId: string): Promise<RosterDetail> {
  return apiGet<RosterDetail>(`${tenantBase(tenantId)}/rms/rosters/${rosterId}`);
}

export function listIncidentUnits(
  tenantId: string,
  incidentId: string,
): Promise<IncidentUnitAssignment[]> {
  return apiGet<IncidentUnitAssignment[]>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/units`,
  );
}

export function createIncidentUnit(
  tenantId: string,
  incidentId: string,
  payload: { unitId: string; isPrimary?: boolean; unitRole?: string | null },
): Promise<ApiResult<IncidentUnitAssignment>> {
  return apiSendResult<IncidentUnitAssignment>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/units`,
    "POST",
    payload,
  );
}

export function deleteIncidentUnit(
  tenantId: string,
  incidentId: string,
  assignmentId: string,
  recordVersion: number,
): Promise<void> {
  return apiSend(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/units/${assignmentId}`,
    "DELETE",
    undefined,
    { ifMatch: toIfMatch(recordVersion) },
  );
}

export function listIncidentPersonnel(
  tenantId: string,
  incidentId: string,
): Promise<IncidentPersonnelAssignment[]> {
  return apiGet<IncidentPersonnelAssignment[]>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/personnel`,
  );
}

export function createIncidentPersonnel(
  tenantId: string,
  incidentId: string,
  payload: {
    personnelId: string;
    unitAssignmentId?: string | null;
    role?: string | null;
  },
): Promise<ApiResult<IncidentPersonnelAssignment>> {
  return apiSendResult<IncidentPersonnelAssignment>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/personnel`,
    "POST",
    payload,
  );
}

export function deleteIncidentPersonnel(
  tenantId: string,
  incidentId: string,
  assignmentId: string,
  recordVersion: number,
): Promise<void> {
  return apiSend(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/personnel/${assignmentId}`,
    "DELETE",
    undefined,
    { ifMatch: toIfMatch(recordVersion) },
  );
}

export function getPrefillCandidates(
  tenantId: string,
  incidentId: string,
  query: {
    stationId?: string;
    personnelId?: string;
    occupancyId?: string;
    preplanId?: string;
  },
): Promise<PrefillCandidate[]> {
  return apiGet<PrefillCandidate[]>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/prefill`,
    {
      query: {
        stationId: query.stationId,
        personnelId: query.personnelId,
        occupancyId: query.occupancyId,
        preplanId: query.preplanId,
      },
    },
  );
}

export async function lookupValueSetOptions(
  tenantId: string,
  valueSetLocation: string,
  search: string,
): Promise<LookupRow[]> {
  const encoded = encodeURIComponent(valueSetLocation);
  const rows = await apiGet<Array<{ id: string; code: string; label: string }>>(
    `/api/v1/platform/neris/value-sets/${encoded}/options`,
    { query: { search, pageSize: "25" } },
  ).catch(() => []);
  return rows.map((row) => ({ id: row.id, label: row.label, subtitle: row.code }));
}

export type CadConnection = {
  id: string;
  publicId: string;
  name: string;
  vendor: string;
  adapterKey: string;
  adapterVersion: string;
  environment: string;
  transportType: string;
  status: string;
  intakeMode: string;
  healthStatus: string;
  recordVersion: number;
  hasCredentialsSecret: boolean;
  hasWebhookSecret: boolean;
  webhookKeyId?: string | null;
  lastMessageAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorSummary?: string | null;
  updatedAt: string;
};

export type CadOperationsSummary = {
  connections: CadConnection[];
  messages: {
    received: number;
    applied: number;
    duplicates: number;
    failed: number;
    deadLetter: number;
    requiresReview: number;
    byStatus: Record<string, number>;
  };
  openConflicts: number;
  unmappedValues: number;
  unknownUnits: number;
  unknownPersonnel: number;
  activeLinks: number;
};

export type CadConflict = {
  id: string;
  incidentId: string | null;
  conflictType: string;
  status: string;
  severity: string;
  fieldIdentifier: string | null;
  resolutionReason: string | null;
  recordVersion: number;
  createdAt: string;
};

export type CadUnmappedValue = {
  id: string;
  category: string;
  sourceField: string;
  sourceValue: string;
  occurrenceCount: number;
  status: string;
  recordVersion: number;
  lastSeenAt: string;
};

export type CadUnknownUnit = {
  id: string;
  sourceUnitId: string;
  sourceUnitCallsign: string | null;
  occurrenceCount: number;
  status: string;
  recordVersion: number;
  lastSeenAt: string;
};

export type CadUnknownPersonnel = {
  id: string;
  sourcePersonnelId: string;
  sourceName: string | null;
  occurrenceCount: number;
  status: string;
  recordVersion: number;
  lastSeenAt: string;
};

export type CadRawMessageMeta = {
  id: string;
  receivedAt: string;
  transportType: string;
  sourceMessageId: string | null;
  sourceIncidentId: string | null;
  processingStatus: string;
  authenticationStatus: string;
  payloadSizeBytes: number | null;
  payloadHash: string | null;
  correlationId: string | null;
  cadConnectionId: string;
};

export type CadIncidentStatus = {
  links: Array<{
    id: string;
    cadConnectionId: string;
    sourceIncidentId: string;
    sourceIncidentNumber: string | null;
    linkStatus: string;
    linkMethod: string;
    recordVersion: number;
    updatedAt: string;
  }>;
  openConflicts: CadConflict[];
  operatingHints: { linked: boolean; conflictCount: number };
};

export function getCadOperationsSummary(tenantId: string): Promise<CadOperationsSummary> {
  return apiGet<CadOperationsSummary>(`${tenantBase(tenantId)}/cad/operations/summary`);
}

export function listCadConnections(tenantId: string): Promise<CadConnection[]> {
  return apiGet<CadConnection[]>(`${tenantBase(tenantId)}/cad/connections`);
}

export function createCadConnection(
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<CadConnection> {
  return apiSend<CadConnection>(`${tenantBase(tenantId)}/cad/connections`, "POST", payload);
}

export function enableCadConnection(tenantId: string, connectionId: string): Promise<CadConnection> {
  return apiSend<CadConnection>(
    `${tenantBase(tenantId)}/cad/connections/${connectionId}/enable`,
    "POST",
  );
}

export function disableCadConnection(tenantId: string, connectionId: string): Promise<CadConnection> {
  return apiSend<CadConnection>(
    `${tenantBase(tenantId)}/cad/connections/${connectionId}/disable`,
    "POST",
  );
}

export function testCadConnection(
  tenantId: string,
  connectionId: string,
): Promise<{ healthy: boolean; status: string; checkedAt: string; connection: CadConnection }> {
  return apiSend(`${tenantBase(tenantId)}/cad/connections/${connectionId}/test`, "POST");
}

export function listCadConflicts(
  tenantId: string,
  query: Record<string, string> = {},
): Promise<CadConflict[]> {
  return apiGet<CadConflict[]>(`${tenantBase(tenantId)}/cad/conflicts`, { query });
}

export function resolveCadConflict(
  tenantId: string,
  conflictId: string,
  payload: {
    resolutionAction: string;
    resolutionReason: string;
    recordVersion: number;
  },
): Promise<CadConflict> {
  return apiSend<CadConflict>(
    `${tenantBase(tenantId)}/cad/conflicts/${conflictId}/resolve`,
    "POST",
    payload,
  );
}

export function listCadUnmappedValues(tenantId: string): Promise<CadUnmappedValue[]> {
  return apiGet<CadUnmappedValue[]>(`${tenantBase(tenantId)}/cad/unmapped-values`);
}

export function resolveCadUnmappedValue(
  tenantId: string,
  unmappedId: string,
  payload: { resolutionReason: string; recordVersion: number; status?: string },
): Promise<CadUnmappedValue> {
  return apiSend<CadUnmappedValue>(
    `${tenantBase(tenantId)}/cad/unmapped-values/${unmappedId}/resolve`,
    "POST",
    payload,
  );
}

export function listCadUnknownUnits(tenantId: string): Promise<CadUnknownUnit[]> {
  return apiGet<CadUnknownUnit[]>(`${tenantBase(tenantId)}/cad/unknown-units`);
}

export function resolveCadUnknownUnit(
  tenantId: string,
  unknownId: string,
  payload: Record<string, unknown>,
): Promise<CadUnknownUnit> {
  return apiSend<CadUnknownUnit>(
    `${tenantBase(tenantId)}/cad/unknown-units/${unknownId}/resolve`,
    "POST",
    payload,
  );
}

export function listCadUnknownPersonnel(tenantId: string): Promise<CadUnknownPersonnel[]> {
  return apiGet<CadUnknownPersonnel[]>(`${tenantBase(tenantId)}/cad/unknown-personnel`);
}

export function resolveCadUnknownPersonnel(
  tenantId: string,
  unknownId: string,
  payload: Record<string, unknown>,
): Promise<CadUnknownPersonnel> {
  return apiSend<CadUnknownPersonnel>(
    `${tenantBase(tenantId)}/cad/unknown-personnel/${unknownId}/resolve`,
    "POST",
    payload,
  );
}

export function listCadMessages(tenantId: string): Promise<CadRawMessageMeta[]> {
  return apiGet<CadRawMessageMeta[]>(`${tenantBase(tenantId)}/cad/messages`);
}

export function getIncidentCadStatus(
  tenantId: string,
  incidentId: string,
): Promise<CadIncidentStatus> {
  return apiGet<CadIncidentStatus>(
    `${tenantBase(tenantId)}/neris/incidents/${incidentId}/cad-status`,
  );
}

// ---------------------------------------------------------------------------
// AI Narrative Assistant (tenant-scoped via auth principal; flags default off)
// ---------------------------------------------------------------------------

export type AiNarrativeRequestType =
  | "GENERATE_FROM_RECORD"
  | "IMPROVE_EXISTING"
  | "GRAMMAR_AND_CLARITY"
  | "EXPAND_BRIEF_NOTES"
  | "CONDENSE"
  | "PROFESSIONALIZE"
  | "ACTIVE_VOICE"
  | "TIMELINE_FORMAT"
  | "QUALITY_REVIEW"
  | "MISSING_INFORMATION_CHECK"
  | "CONTRADICTION_CHECK";

export type AiNarrativeDraft = {
  id: string;
  draftText: string;
  structuredResponseJson: {
    narrative?: string;
    missingInformation?: string[];
    conflicts?: string[];
    warnings?: string[];
    unsupportedClaims?: string[];
    sourceReferences?: string[];
  };
  confidenceSummary: string | null;
  warningsJson: unknown;
  missingInformationJson: unknown;
  unsupportedClaimsJson: unknown;
  sourceMappingJson: unknown;
  label: string;
  version: number;
  acceptedAt: string | null;
};

export type AiNarrativeSource = {
  id: string;
  manifestJson: {
    fields?: Array<{
      fieldId: string;
      label: string;
      category: string;
      included: boolean;
      redacted?: boolean;
      valuePreview?: string;
    }>;
    sourceHash?: string;
  };
  redactionSummaryJson: unknown;
};

export type AiNarrativeBundle = {
  request: {
    id: string;
    status: string;
    requestType: string;
    product: string;
    module: string;
    recordType: string;
    recordId: string;
    provider: string | null;
    createdAt: string;
  };
  sources: AiNarrativeSource[];
  drafts: AiNarrativeDraft[];
  requiredWarning: string;
  humanReviewRequired: boolean;
};

export type AiNarrativeHistory = {
  request: AiNarrativeBundle["request"];
  drafts: AiNarrativeDraft[];
  revisions: Array<{
    id: string;
    action: string;
    createdAt: string;
    snapshotJson: unknown;
  }>;
};

export function createAiNarrative(payload: {
  product: "RMS";
  module: string;
  recordType: string;
  recordId: string;
  requestType: AiNarrativeRequestType;
  acknowledgeWarning: true;
  existingNarrative?: string | null;
  tone?: "NEUTRAL" | "FORMAL" | "CONCISE" | "DETAILED";
  detailLevel?: "BRIEF" | "STANDARD" | "DETAILED";
  authorizeSensitiveData?: boolean;
}): Promise<AiNarrativeBundle> {
  return apiSend<AiNarrativeBundle>("/api/v1/ai/narratives", "POST", {
    tone: "NEUTRAL",
    detailLevel: "STANDARD",
    includeCategories: [],
    excludeCategories: [],
    authorizeSensitiveData: false,
    idempotencyKey: createIdempotencyKey("ai-narrative"),
    ...payload,
  });
}

export function getAiNarrative(requestId: string): Promise<AiNarrativeBundle> {
  return apiGet<AiNarrativeBundle>(`/api/v1/ai/narratives/${requestId}`);
}

export function regenerateAiNarrative(requestId: string): Promise<AiNarrativeBundle> {
  return apiSend<AiNarrativeBundle>(`/api/v1/ai/narratives/${requestId}/regenerate`, "POST");
}

export function acceptAiNarrative(
  requestId: string,
  payload: {
    draftId: string;
    mode?: "ACCEPT_ALL" | "PARTIAL";
    selectedSections?: string[];
    insertIntoRecord?: boolean;
    feedback?: string | null;
  },
): Promise<AiNarrativeBundle> {
  return apiSend<AiNarrativeBundle>(`/api/v1/ai/narratives/${requestId}/accept`, "POST", payload);
}

export function partialAcceptAiNarrative(
  requestId: string,
  payload: {
    draftId: string;
    selectedSections?: string[];
    insertIntoRecord?: boolean;
    feedback?: string | null;
  },
): Promise<AiNarrativeBundle> {
  return apiSend<AiNarrativeBundle>(
    `/api/v1/ai/narratives/${requestId}/partial-accept`,
    "POST",
    payload,
  );
}

export function rejectAiNarrative(
  requestId: string,
  payload: { draftId: string; reason: string; feedback?: string | null },
): Promise<AiNarrativeBundle> {
  return apiSend<AiNarrativeBundle>(`/api/v1/ai/narratives/${requestId}/reject`, "POST", payload);
}

export function getAiNarrativeHistory(requestId: string): Promise<AiNarrativeHistory> {
  return apiGet<AiNarrativeHistory>(`/api/v1/ai/narratives/${requestId}/history`);
}


export type HydrantSummary={
  id:string;displayId:string;officialHydrantId:string|null;district:string|null;
  addressLine1:string|null;city:string|null;state:string|null;status:string;
  waterProvider:string|null;flowGpm:number|null;staticPsi:number|null;residualPsi:number|null;
  nfpaClass:string|null;nfpaColor:string|null;lastInspectionDate:string|null;lastFlowTestDate:string|null;
  recordVersion:number;createdAt:string;updatedAt:string;
};
export type HydrantDetail=HydrantSummary&{
  locationId:string|null;postalCode:string|null;latitude:number|null;longitude:number|null;
  waterAssociation:string|null;subdivision:string|null;dischargeSize:number|null;hydrantType:string|null;
  manufacturer:string|null;model:string|null;installDate:string|null;issue:string|null;
  alternateSupply:string|null;notes:string|null;
};
export type HydrantFlowTest={id:string;testDate:string;staticPsi:number|null;residualPsi:number|null;pitotPsi:number|null;dischargeSize:number|null;flowGpm:number;nfpaClass:string|null;nfpaColor:string|null;testedBy:string|null;shift:string|null;flowResult:string|null;status:string|null;notes:string|null;createdAt:string};
export type HydrantInspection={id:string;inspectionAt:string;operationalStatus:string;inspector:string|null;checklistJson:Record<string,unknown>;issueCount:number;notes:string|null;createdAt:string};
export type HydrantDamageReport={id:string;reportedAt:string;severity:string;operationalStatus:string;leakPresent:boolean|null;trafficHazard:boolean|null;alternateWaterSupply:string|null;waterProvider:string|null;workOrderReference:string|null;reportedBy:string|null;notes:string|null;createdAt:string};

export function listHydrants(tenantId:string,query:Record<string,string>):Promise<ApiResult<HydrantSummary[]>>{
  return apiGetResult<HydrantSummary[]>(`${tenantBase(tenantId)}/rms/hydrants`,{query});
}
export function getHydrant(tenantId:string,hydrantId:string):Promise<HydrantDetail>{
  return apiGet<HydrantDetail>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}`);
}
export function createHydrant(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<HydrantDetail>>{
  return apiSendResult<HydrantDetail>(`${tenantBase(tenantId)}/rms/hydrants`,"POST",payload,{idempotencyKey:createIdempotencyKey("hydrant")});
}
export function patchHydrant(tenantId:string,hydrantId:string,payload:Record<string,unknown>,recordVersion:number):Promise<ApiResult<HydrantDetail>>{
  return apiSendResult<HydrantDetail>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function listHydrantFlowTests(tenantId:string,hydrantId:string):Promise<HydrantFlowTest[]>{
  return apiGet<HydrantFlowTest[]>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}/flow-tests`);
}
export function createHydrantFlowTest(tenantId:string,hydrantId:string,payload:Record<string,unknown>):Promise<HydrantFlowTest>{
  return apiSend<HydrantFlowTest>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}/flow-tests`,"POST",payload,{idempotencyKey:createIdempotencyKey("hydrant-flow")});
}
export function listHydrantInspections(tenantId:string,hydrantId:string):Promise<HydrantInspection[]>{
  return apiGet<HydrantInspection[]>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}/inspections`);
}
export function createHydrantInspection(tenantId:string,hydrantId:string,payload:Record<string,unknown>):Promise<HydrantInspection>{
  return apiSend<HydrantInspection>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}/inspections`,"POST",payload,{idempotencyKey:createIdempotencyKey("hydrant-inspection")});
}
export function listHydrantDamageReports(tenantId:string,hydrantId:string):Promise<HydrantDamageReport[]>{
  return apiGet<HydrantDamageReport[]>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}/damage-reports`);
}
export function createHydrantDamageReport(tenantId:string,hydrantId:string,payload:Record<string,unknown>):Promise<HydrantDamageReport>{
  return apiSend<HydrantDamageReport>(`${tenantBase(tenantId)}/rms/hydrants/${hydrantId}/damage-reports`,"POST",payload,{idempotencyKey:createIdempotencyKey("hydrant-damage")});
}


export type OccupancySummary={
  id:string;name:string;addressLine1:string|null;city:string|null;state:string|null;postalCode:string|null;
  primaryContact:string|null;occupancyType:string|null;status:string;preplanId:string|null;
  latitude:number|null;longitude:number|null;recordVersion:number;createdAt:string;updatedAt:string;
};
export type PreplanSummary={
  id:string;occupancyId:string;versionLabel:string;approvalStatus:"DRAFT"|"APPROVED"|"SUPERSEDED";
  tacticalSummary:string|null;hazards:string|null;accessNotes:string|null;utilityNotes:string|null;
  primaryStationId:string|null;recordVersion:number;createdAt:string;updatedAt:string;
};

export function listOccupancies(tenantId:string,query:Record<string,string>):Promise<ApiResult<OccupancySummary[]>>{
  return apiGetResult<OccupancySummary[]>(`${tenantBase(tenantId)}/rms/occupancies`,{query});
}
export function createOccupancy(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<OccupancySummary>>{
  return apiSendResult<OccupancySummary>(`${tenantBase(tenantId)}/rms/occupancies`,"POST",payload,{idempotencyKey:createIdempotencyKey("occupancy")});
}
export function listPreplans(tenantId:string,query:Record<string,string>):Promise<ApiResult<PreplanSummary[]>>{
  return apiGetResult<PreplanSummary[]>(`${tenantBase(tenantId)}/rms/preplans`,{query});
}
export function getPreplan(tenantId:string,preplanId:string):Promise<PreplanSummary>{
  return apiGet<PreplanSummary>(`${tenantBase(tenantId)}/rms/preplans/${preplanId}`);
}
export function createPreplan(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<PreplanSummary>>{
  return apiSendResult<PreplanSummary>(`${tenantBase(tenantId)}/rms/preplans`,"POST",payload,{idempotencyKey:createIdempotencyKey("preplan")});
}


export function patchOccupancy(
  tenantId:string,
  occupancyId:string,
  payload:Record<string,unknown>,
  recordVersion:number,
):Promise<ApiResult<OccupancyDetail>>{
  return apiSendResult<OccupancyDetail>(
    `${tenantBase(tenantId)}/rms/occupancies/${occupancyId}`,
    "PATCH",
    payload,
    {ifMatch:toIfMatch(recordVersion)},
  );
}
export function patchPreplan(
  tenantId:string,
  preplanId:string,
  payload:Record<string,unknown>,
  recordVersion:number,
):Promise<ApiResult<PreplanSummary>>{
  return apiSendResult<PreplanSummary>(
    `${tenantBase(tenantId)}/rms/preplans/${preplanId}`,
    "PATCH",
    payload,
    {ifMatch:toIfMatch(recordVersion)},
  );
}


export type PersonSummary={
  id:string;forgePersonNumber:string;firstName:string;middleName:string|null;lastName:string;
  preferredName:string|null;displayName:string;email:string|null;phone:string|null;status:string;
  recordVersion:number;createdAt:string;updatedAt:string;
};
export type RmsPersonnelSummary={
  id:string;personId:string;rank:string|null;qualificationSummary:string|null;stationId:string|null;
  shiftId:string|null;status:string;incidentEligible:boolean;recordVersion:number;createdAt:string;updatedAt:string;
};

export function listPersons(tenantId:string,q=""):Promise<ApiResult<PersonSummary[]>>{
  return apiGetResult<PersonSummary[]>(`${tenantBase(tenantId)}/persons`,{query:q.trim()?{q:q.trim()}:{}});
}
export function getPerson(tenantId:string,personId:string):Promise<PersonSummary>{
  return apiGet<PersonSummary>(`${tenantBase(tenantId)}/persons/${personId}`);
}
export function createPerson(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<PersonSummary>>{
  return apiSendResult<PersonSummary>(`${tenantBase(tenantId)}/persons`,"POST",payload,{idempotencyKey:createIdempotencyKey("person")});
}
export function listPersonnel(tenantId:string,query:Record<string,string>):Promise<ApiResult<RmsPersonnelSummary[]>>{
  return apiGetResult<RmsPersonnelSummary[]>(`${tenantBase(tenantId)}/rms/personnel`,{query});
}
export function createRmsPersonnel(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<RmsPersonnelSummary>>{
  return apiSendResult<RmsPersonnelSummary>(`${tenantBase(tenantId)}/rms/personnel`,"POST",payload,{idempotencyKey:createIdempotencyKey("rms-personnel")});
}
export function getRmsPersonnel(tenantId:string,personnelId:string):Promise<RmsPersonnelSummary>{
  return apiGet<RmsPersonnelSummary>(`${tenantBase(tenantId)}/rms/personnel/${personnelId}`);
}
export function listApparatus(tenantId:string,query:Record<string,string>):Promise<ApiResult<ApparatusDetail[]>>{
  return apiGetResult<ApparatusDetail[]>(`${tenantBase(tenantId)}/rms/apparatus`,{query});
}
export function createApparatus(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<ApparatusDetail&{recordVersion:number}>>{
  return apiSendResult<ApparatusDetail&{recordVersion:number}>(`${tenantBase(tenantId)}/rms/apparatus`,"POST",payload,{idempotencyKey:createIdempotencyKey("apparatus")});
}


export function listUnits(tenantId:string,query:Record<string,string>):Promise<ApiResult<UnitDetail[]>>{
  return apiGetResult<UnitDetail[]>(`${tenantBase(tenantId)}/rms/units`,{query});
}
export function createUnit(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<UnitDetail>>{
  return apiSendResult<UnitDetail>(`${tenantBase(tenantId)}/rms/units`,"POST",payload,{idempotencyKey:createIdempotencyKey("unit")});
}


export type StationSummary={
  id:string;stationNumber:string;name:string;status:string;addressLine1:string|null;addressLine2:string|null;
  city:string|null;state:string|null;postalCode:string|null;timezone:string;defaultResponseDistrict:string|null;
  recordVersion:number;createdAt:string;updatedAt:string;
};
export type ShiftSummary={
  id:string;name:string;code:string;status:string;scheduleReference:string|null;
  recordVersion:number;createdAt:string;updatedAt:string;
};

export function listStations(tenantId:string,query:Record<string,string>):Promise<ApiResult<StationSummary[]>>{
  return apiGetResult<StationSummary[]>(`${tenantBase(tenantId)}/rms/stations`,{query});
}
export function createStation(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<StationSummary>>{
  return apiSendResult<StationSummary>(`${tenantBase(tenantId)}/rms/stations`,"POST",payload,{idempotencyKey:createIdempotencyKey("station")});
}
export function listShifts(tenantId:string,query:Record<string,string>):Promise<ApiResult<ShiftSummary[]>>{
  return apiGetResult<ShiftSummary[]>(`${tenantBase(tenantId)}/rms/shifts`,{query});
}
export function createShift(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<ShiftSummary>>{
  return apiSendResult<ShiftSummary>(`${tenantBase(tenantId)}/rms/shifts`,"POST",payload,{idempotencyKey:createIdempotencyKey("shift")});
}


export function listRosters(tenantId:string,query:Record<string,string>):Promise<ApiResult<Array<Omit<RosterDetail,"assignments">>>>{
  return apiGetResult<Array<Omit<RosterDetail,"assignments">>>(`${tenantBase(tenantId)}/rms/rosters`,{query});
}
export function createRoster(
  tenantId:string,
  payload:{rosterDate:string;shiftId:string;stationId:string;status?:"ACTIVE"|"INACTIVE"},
):Promise<ApiResult<RosterDetail>>{
  return apiSendResult<RosterDetail>(`${tenantBase(tenantId)}/rms/rosters`,"POST",payload,{idempotencyKey:createIdempotencyKey("roster")});
}
export type RosterAssignment={
  id:string;rosterId:string;personnelId:string;unitId:string|null;assignmentRole:string;
  isOfficer:boolean;incidentCommanderEligible:boolean;recordVersion:number;createdAt:string;updatedAt:string;
};
export function addRosterAssignment(
  tenantId:string,
  rosterId:string,
  payload:{personnelId:string;unitId?:string|null;assignmentRole?:string;isOfficer?:boolean;incidentCommanderEligible?:boolean},
):Promise<ApiResult<RosterAssignment>>{
  return apiSendResult<RosterAssignment>(`${tenantBase(tenantId)}/rms/rosters/${rosterId}/assignments`,"POST",payload,{idempotencyKey:createIdempotencyKey("roster-assignment")});
}
export function removeRosterAssignment(tenantId:string,rosterId:string,assignmentId:string):Promise<void>{
  return apiSend<void>(`${tenantBase(tenantId)}/rms/rosters/${rosterId}/assignments/${assignmentId}`,"DELETE");
}


export type InspectionProgram={
  id:string;name:string;code:string|null;description:string|null;active:boolean;frequency:string|null;
  recordVersion:number;createdAt:string;updatedAt:string;
};
export type InspectionTemplate={
  id:string;programId:string|null;name:string;lifecycleStatus:"DRAFT"|"PUBLISHED"|"RETIRED";version:number;
  sectionsJson:Array<Record<string,unknown>>;recordVersion:number;createdAt:string;updatedAt:string;
};
export type InspectionSummary={
  id:string;occupancyId:string;programId:string|null;templateId:string|null;inspectorName:string|null;
  inspectionDate:string;scheduledDate:string|null;startedAt:string|null;completedAt:string|null;
  status:"SCHEDULED"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
  overallResult:"PENDING"|"PASS"|"CONDITIONAL"|"FAIL";followUpDate:string|null;notes:string|null;
  checklistSnapshotJson:Array<Record<string,unknown>>;recordVersion:number;createdAt:string;updatedAt:string;
};
export type InspectionResponse={
  id:string;inspectionId:string;sectionId:string|null;fieldKey:string;fieldLabel:string|null;result:string|null;
  valueJson:unknown;comment:string|null;recordVersion:number;
};
export type InspectionFinding={
  id:string;inspectionId:string;responseId:string|null;title:string;description:string|null;
  severity:"LOW"|"MODERATE"|"HIGH"|"CRITICAL";correctiveAction:string|null;responsibleParty:string|null;
  dueDate:string|null;status:"OPEN"|"CORRECTED"|"VERIFIED"|"VOID";correctedAt:string|null;verifiedAt:string|null;
  verificationNotes:string|null;recordVersion:number;
};
export type InspectionDetail={inspection:InspectionSummary;responses:InspectionResponse[];findings:InspectionFinding[]};

export function listInspectionPrograms(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<InspectionProgram[]>>{
  return apiGetResult<InspectionProgram[]>(`${tenantBase(tenantId)}/rms/inspection-programs`,{query});
}
export function createInspectionProgram(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<InspectionProgram>>{
  return apiSendResult<InspectionProgram>(`${tenantBase(tenantId)}/rms/inspection-programs`,"POST",payload,{idempotencyKey:createIdempotencyKey("inspection-program")});
}
export function listInspectionTemplates(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<InspectionTemplate[]>>{
  return apiGetResult<InspectionTemplate[]>(`${tenantBase(tenantId)}/rms/inspection-templates`,{query});
}
export function createInspectionTemplate(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<InspectionTemplate>>{
  return apiSendResult<InspectionTemplate>(`${tenantBase(tenantId)}/rms/inspection-templates`,"POST",payload,{idempotencyKey:createIdempotencyKey("inspection-template")});
}
export function listInspections(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<InspectionSummary[]>>{
  return apiGetResult<InspectionSummary[]>(`${tenantBase(tenantId)}/rms/inspections`,{query});
}
export function getInspection(tenantId:string,inspectionId:string):Promise<InspectionDetail>{
  return apiGet<InspectionDetail>(`${tenantBase(tenantId)}/rms/inspections/${inspectionId}`);
}
export function createInspection(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<InspectionSummary>>{
  return apiSendResult<InspectionSummary>(`${tenantBase(tenantId)}/rms/inspections`,"POST",payload,{idempotencyKey:createIdempotencyKey("inspection")});
}
export function patchInspection(tenantId:string,inspectionId:string,payload:Record<string,unknown>,recordVersion:number):Promise<ApiResult<InspectionSummary>>{
  return apiSendResult<InspectionSummary>(`${tenantBase(tenantId)}/rms/inspections/${inspectionId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function upsertInspectionResponse(tenantId:string,inspectionId:string,payload:Record<string,unknown>):Promise<InspectionResponse>{
  return apiSend<InspectionResponse>(`${tenantBase(tenantId)}/rms/inspections/${inspectionId}/responses`,"POST",payload,{idempotencyKey:createIdempotencyKey("inspection-response")});
}
export function createInspectionFinding(tenantId:string,inspectionId:string,payload:Record<string,unknown>):Promise<InspectionFinding>{
  return apiSend<InspectionFinding>(`${tenantBase(tenantId)}/rms/inspections/${inspectionId}/findings`,"POST",payload,{idempotencyKey:createIdempotencyKey("inspection-finding")});
}
export function patchInspectionFinding(tenantId:string,findingId:string,payload:Record<string,unknown>,recordVersion:number):Promise<InspectionFinding>{
  return apiSend<InspectionFinding>(`${tenantBase(tenantId)}/rms/inspection-findings/${findingId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}


export function patchInspectionProgram(tenantId:string,programId:string,payload:Record<string,unknown>,recordVersion:number):Promise<ApiResult<InspectionProgram>>{
  return apiSendResult<InspectionProgram>(`${tenantBase(tenantId)}/rms/inspection-programs/${programId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function patchInspectionTemplate(tenantId:string,templateId:string,payload:Record<string,unknown>,recordVersion:number):Promise<ApiResult<InspectionTemplate>>{
  return apiSendResult<InspectionTemplate>(`${tenantBase(tenantId)}/rms/inspection-templates/${templateId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}


export type CodeCase={
  id:string;caseNumber:string;occupancyId:string;inspectionId:string|null;caseType:"VIOLATION"|"COMPLAINT"|"ORDER"|"CITATION";
  status:"OPEN"|"NOTICE_ISSUED"|"COMPLIANCE_PENDING"|"HEARING"|"CLOSED"|"VOID";openedAt:string;complianceDueDate:string|null;
  closedAt:string|null;responsibleParty:string|null;contactEmail:string|null;contactPhone:string|null;summary:string|null;notes:string|null;
  recordVersion:number;createdAt:string;updatedAt:string;
};
export type CodeViolation={
  id:string;caseId:string;inspectionFindingId:string|null;codeReference:string|null;title:string;description:string|null;
  severity:"LOW"|"MODERATE"|"HIGH"|"CRITICAL";status:"OPEN"|"CORRECTED"|"VERIFIED"|"VOID";correctiveAction:string|null;
  correctionDueDate:string|null;correctedAt:string|null;verifiedAt:string|null;verificationNotes:string|null;fineAmount:number|null;
  recordVersion:number;
};
export type CodeNotice={
  id:string;caseId:string;noticeType:"WARNING"|"NOTICE_OF_VIOLATION"|"ORDER_TO_CORRECT"|"CITATION";issuedAt:string;
  recipient:string|null;deliveryMethod:string|null;servedAt:string|null;subject:string|null;bodySnapshot:string;createdAt:string;
};
export type CodeCaseDetail={case:CodeCase;violations:CodeViolation[];notices:CodeNotice[]};

export function listCodeCases(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<CodeCase[]>>{
  return apiGetResult<CodeCase[]>(`${tenantBase(tenantId)}/rms/code-cases`,{query});
}
export function getCodeCase(tenantId:string,caseId:string):Promise<CodeCaseDetail>{
  return apiGet<CodeCaseDetail>(`${tenantBase(tenantId)}/rms/code-cases/${caseId}`);
}
export function createCodeCase(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<CodeCase>>{
  return apiSendResult<CodeCase>(`${tenantBase(tenantId)}/rms/code-cases`,"POST",payload,{idempotencyKey:createIdempotencyKey("code-case")});
}
export function createCodeCaseFromFinding(tenantId:string,findingId:string):Promise<{case:CodeCase;violation:CodeViolation;existing:boolean}>{
  return apiSend<{case:CodeCase;violation:CodeViolation;existing:boolean}>(`${tenantBase(tenantId)}/rms/code-cases/from-finding/${findingId}`,"POST",{}, {idempotencyKey:createIdempotencyKey("code-case-finding")});
}
export function patchCodeCase(tenantId:string,caseId:string,payload:Record<string,unknown>,recordVersion:number):Promise<ApiResult<CodeCase>>{
  return apiSendResult<CodeCase>(`${tenantBase(tenantId)}/rms/code-cases/${caseId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function createCodeViolation(tenantId:string,caseId:string,payload:Record<string,unknown>):Promise<CodeViolation>{
  return apiSend<CodeViolation>(`${tenantBase(tenantId)}/rms/code-cases/${caseId}/violations`,"POST",payload,{idempotencyKey:createIdempotencyKey("code-violation")});
}
export function patchCodeViolation(tenantId:string,violationId:string,payload:Record<string,unknown>,recordVersion:number):Promise<CodeViolation>{
  return apiSend<CodeViolation>(`${tenantBase(tenantId)}/rms/code-violations/${violationId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function issueCodeNotice(tenantId:string,caseId:string,payload:Record<string,unknown>):Promise<{notice:CodeNotice;case:CodeCase}>{
  return apiSend<{notice:CodeNotice;case:CodeCase}>(`${tenantBase(tenantId)}/rms/code-cases/${caseId}/notices`,"POST",payload,{idempotencyKey:createIdempotencyKey("code-notice")});
}


export type InvestigationCase={
  id:string;caseNumber:string;incidentId:string|null;occupancyId:string|null;
  caseType:"FIRE_INVESTIGATION"|"ORIGIN_CAUSE"|"CODE_REFERRAL"|"ADMIN_REVIEW";
  leadInvestigator:string|null;status:"OPEN"|"SCENE_SECURED"|"ANALYSIS"|"PENDING_REVIEW"|"CLOSED"|"VOID";
  openedAt:string;closedAt:string|null;location:string|null;sceneStatus:"SECURED"|"RELEASED"|"RESTRICTED"|null;
  weather:string|null;initialObservations:string|null;areaOfOrigin:string|null;
  causeClassification:"UNDETERMINED"|"ACCIDENTAL"|"INCENDIARY"|"NATURAL"|"OTHER"|null;
  causeNarrative:string|null;disposition:string|null;
  supervisorReviewStatus:"NOT_SUBMITTED"|"PENDING"|"APPROVED"|"RETURNED";
  supervisorReviewer:string|null;supervisorReviewedAt:string|null;supervisorNotes:string|null;
  recordVersion:number;createdAt:string;updatedAt:string;
};
export type InvestigationEvidence={
  id:string;caseId:string;evidenceType:"PHOTO"|"PHYSICAL"|"DOCUMENT"|"INTERVIEW"|"VIDEO"|"OTHER";
  tagNumber:string;title:string|null;description:string|null;collectedAt:string|null;collectedBy:string|null;
  currentCustodian:string|null;storageLocation:string|null;status:"IN_CUSTODY"|"RELEASED"|"RETURNED"|"DISPOSED";
  notes:string|null;recordVersion:number;createdAt:string;updatedAt:string;
};
export type InvestigationCustodyEvent={
  id:string;evidenceId:string;action:"COLLECTED"|"TRANSFERRED"|"STORED"|"RELEASED"|"RETURNED"|"DISPOSED";
  occurredAt:string;fromCustodian:string|null;toCustodian:string|null;location:string|null;notes:string|null;createdAt:string;
};
export type InvestigationDetail={case:InvestigationCase;evidence:InvestigationEvidence[];custodyEvents:InvestigationCustodyEvent[]};

export function listInvestigations(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<InvestigationCase[]>>{
  return apiGetResult<InvestigationCase[]>(`${tenantBase(tenantId)}/rms/investigations`,{query});
}
export function getInvestigation(tenantId:string,caseId:string):Promise<InvestigationDetail>{
  return apiGet<InvestigationDetail>(`${tenantBase(tenantId)}/rms/investigations/${caseId}`);
}
export function createInvestigation(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<InvestigationCase>>{
  return apiSendResult<InvestigationCase>(`${tenantBase(tenantId)}/rms/investigations`,"POST",payload,{idempotencyKey:createIdempotencyKey("investigation")});
}
export function patchInvestigation(tenantId:string,caseId:string,payload:Record<string,unknown>,recordVersion:number):Promise<ApiResult<InvestigationCase>>{
  return apiSendResult<InvestigationCase>(`${tenantBase(tenantId)}/rms/investigations/${caseId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function createInvestigationEvidence(tenantId:string,caseId:string,payload:Record<string,unknown>):Promise<InvestigationEvidence>{
  return apiSend<InvestigationEvidence>(`${tenantBase(tenantId)}/rms/investigations/${caseId}/evidence`,"POST",payload,{idempotencyKey:createIdempotencyKey("investigation-evidence")});
}
export function patchInvestigationEvidence(tenantId:string,evidenceId:string,payload:Record<string,unknown>,recordVersion:number):Promise<InvestigationEvidence>{
  return apiSend<InvestigationEvidence>(`${tenantBase(tenantId)}/rms/investigation-evidence/${evidenceId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function addInvestigationCustodyEvent(tenantId:string,evidenceId:string,payload:Record<string,unknown>):Promise<{event:InvestigationCustodyEvent;evidence:InvestigationEvidence}>{
  return apiSend<{event:InvestigationCustodyEvent;evidence:InvestigationEvidence}>(`${tenantBase(tenantId)}/rms/investigation-evidence/${evidenceId}/custody-events`,"POST",payload,{idempotencyKey:createIdempotencyKey("investigation-custody")});
}


export type TrainingCourse={
  id:string;code:string;title:string;category:string;description:string|null;deliveryMode:string;
  defaultHours:number|null;recurrenceMonths:number|null;requiredForIncidentEligibility:boolean;
  status:string;recordVersion:number;createdAt:string;updatedAt:string;
};
export type TrainingRecord={
  id:string;courseId:string;personnelId:string;completedAt:string;expiresAt:string|null;hours:number|null;
  status:string;instructor:string|null;location:string|null;score:number|null;certificateNumber:string|null;
  notes:string|null;source:string;recordVersion:number;createdAt:string;updatedAt:string;
};
export type CertificationType={
  id:string;code:string;name:string;issuingAuthority:string|null;category:string;defaultValidityMonths:number|null;
  requiredForIncidentEligibility:boolean;status:string;recordVersion:number;createdAt:string;updatedAt:string;
};
export type PersonnelCertification={
  id:string;personnelId:string;certificationTypeId:string;credentialNumber:string|null;issuedAt:string|null;
  expiresAt:string|null;status:string;verifiedAt:string|null;verifiedBy:string|null;notes:string|null;
  recordVersion:number;createdAt:string;updatedAt:string;
};
export type PersonnelReadiness={
  personnelId:string;eligible:boolean;
  training:Array<{courseId:string;code:string;title:string;current:boolean;completedAt:string|null;expiresAt:string|null}>;
  certifications:Array<{certificationTypeId:string;code:string;name:string;current:boolean;credentialNumber:string|null;expiresAt:string|null}>;
  missingTraining:Array<{courseId:string;code:string;title:string;current:boolean;completedAt:string|null;expiresAt:string|null}>;
  missingCertifications:Array<{certificationTypeId:string;code:string;name:string;current:boolean;credentialNumber:string|null;expiresAt:string|null}>;
  computedAt:string;
};

export function listTrainingCourses(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<TrainingCourse[]>>{
  return apiGetResult<TrainingCourse[]>(`${tenantBase(tenantId)}/rms/training/courses`,{query});
}
export function createTrainingCourse(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<TrainingCourse>>{
  return apiSendResult<TrainingCourse>(`${tenantBase(tenantId)}/rms/training/courses`,"POST",payload,{idempotencyKey:createIdempotencyKey("training-course")});
}
export function patchTrainingCourse(tenantId:string,courseId:string,payload:Record<string,unknown>,recordVersion:number):Promise<ApiResult<TrainingCourse>>{
  return apiSendResult<TrainingCourse>(`${tenantBase(tenantId)}/rms/training/courses/${courseId}`,"PATCH",payload,{ifMatch:toIfMatch(recordVersion)});
}
export function listTrainingRecords(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<TrainingRecord[]>>{
  return apiGetResult<TrainingRecord[]>(`${tenantBase(tenantId)}/rms/training/records`,{query});
}
export function createTrainingRecord(tenantId:string,payload:Record<string,unknown>):Promise<TrainingRecord>{
  return apiSend<TrainingRecord>(`${tenantBase(tenantId)}/rms/training/records`,"POST",payload,{idempotencyKey:createIdempotencyKey("training-record")});
}
export function listCertificationTypes(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<CertificationType[]>>{
  return apiGetResult<CertificationType[]>(`${tenantBase(tenantId)}/rms/certifications/types`,{query});
}
export function createCertificationType(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<CertificationType>>{
  return apiSendResult<CertificationType>(`${tenantBase(tenantId)}/rms/certifications/types`,"POST",payload,{idempotencyKey:createIdempotencyKey("certification-type")});
}
export function listPersonnelCertifications(tenantId:string,query:Record<string,string>={}):Promise<ApiResult<PersonnelCertification[]>>{
  return apiGetResult<PersonnelCertification[]>(`${tenantBase(tenantId)}/rms/certifications/personnel`,{query});
}
export function createPersonnelCertification(tenantId:string,payload:Record<string,unknown>):Promise<ApiResult<PersonnelCertification>>{
  return apiSendResult<PersonnelCertification>(`${tenantBase(tenantId)}/rms/certifications/personnel`,"POST",payload,{idempotencyKey:createIdempotencyKey("personnel-certification")});
}
export function getPersonnelReadiness(tenantId:string,personnelId:string):Promise<PersonnelReadiness>{
  return apiGet<PersonnelReadiness>(`${tenantBase(tenantId)}/rms/training/readiness/${personnelId}`);
}
