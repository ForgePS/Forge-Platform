import { redactSensitive } from "@forge/security";

export type AuditActorType = "USER" | "SYSTEM" | "SERVICE";
export type AuditResult = "SUCCESS" | "DENIED" | "FAILURE";
export type AuditRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AuditEventInput {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  actorPersonId: string | null;
  actorType: AuditActorType;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  organizationId?: string | null;
  result: AuditResult;
  riskLevel: AuditRiskLevel;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId: string;
  requestId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export function redactAuditSnapshot(value: unknown): unknown {
  return redactSensitive(value);
}

export function buildAuditRecord(input: AuditEventInput) {
  return {
    id: input.id,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorPersonId: input.actorPersonId,
    actorType: input.actorType,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    organizationId: input.organizationId ?? null,
    result: input.result,
    riskLevel: input.riskLevel,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    correlationId: input.correlationId,
    requestId: input.requestId,
    beforeJson: input.before === undefined ? null : redactAuditSnapshot(input.before),
    afterJson: input.after === undefined ? null : redactAuditSnapshot(input.after),
    metadataJson: redactAuditSnapshot(input.metadata ?? {}),
    occurredAt: input.occurredAt ?? new Date(),
  };
}

export function maskSensitiveValue(type: string, value: string): string {
  const digits = value.replace(/\D/g, "");
  if (type === "SSN" && digits.length >= 4) {
    return `***-**-${digits.slice(-4)}`;
  }
  if (digits.length >= 4) {
    return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
  }
  return "****";
}
