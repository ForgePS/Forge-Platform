import { Injectable } from "@nestjs/common";
import type { NerisIncidentStatus } from "@forge/contracts";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";

const EDITABLE_STATUSES: NerisIncidentStatus[] = [
  "DRAFT",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
  "RETURNED_FOR_CORRECTION",
];

const LOCKED_STATUSES: NerisIncidentStatus[] = ["FINALIZED", "VOIDED", "ARCHIVED"];

const TRANSITIONS: Record<NerisIncidentStatus, NerisIncidentStatus[]> = {
  DRAFT: ["IN_PROGRESS", "VOIDED"],
  IN_PROGRESS: ["READY_FOR_REVIEW", "VOIDED"],
  READY_FOR_REVIEW: ["SUBMITTED_FOR_REVIEW", "IN_PROGRESS", "VOIDED"],
  SUBMITTED_FOR_REVIEW: ["RETURNED_FOR_CORRECTION", "APPROVED", "VOIDED"],
  RETURNED_FOR_CORRECTION: ["IN_PROGRESS", "VOIDED"],
  APPROVED: ["FINALIZED", "VOIDED"],
  FINALIZED: ["ARCHIVED"],
  VOIDED: [],
  ARCHIVED: [],
};

const PERMISSIONS: Partial<Record<NerisIncidentStatus, string>> = {
  SUBMITTED_FOR_REVIEW: "rms.neris.incident.submit_review",
  RETURNED_FOR_CORRECTION: "rms.neris.incident.return",
  APPROVED: "rms.neris.incident.approve",
  FINALIZED: "rms.neris.incident.finalize",
  VOIDED: "rms.neris.incident.void",
  ARCHIVED: "rms.neris.incident.archive",
};

@Injectable()
export class IncidentStateMachineService {
  assertEditable(status: NerisIncidentStatus): void {
    if (LOCKED_STATUSES.includes(status)) {
      throw new ForgeError("CONFLICT", `Incident is locked in status ${status}`);
    }
  }

  isEditable(status: NerisIncidentStatus): boolean {
    return EDITABLE_STATUSES.includes(status);
  }

  isLocked(status: NerisIncidentStatus): boolean {
    return LOCKED_STATUSES.includes(status);
  }

  /**
   * First meaningful edit promotes DRAFT to IN_PROGRESS; corrections after a
   * return promote RETURNED_FOR_CORRECTION back to IN_PROGRESS (plan state
   * machine: RETURNED_FOR_CORRECTION -> IN_PROGRESS on corrections).
   */
  promoteDraftIfNeeded(current: NerisIncidentStatus): NerisIncidentStatus {
    if (current === "DRAFT" || current === "RETURNED_FOR_CORRECTION") {
      return "IN_PROGRESS";
    }
    return current;
  }

  assertTransition(
    from: NerisIncidentStatus,
    to: NerisIncidentStatus,
    principal: ForgePrincipal,
  ): void {
    const allowed = TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ForgeError("CONFLICT", `Cannot transition incident from ${from} to ${to}`);
    }
    const permission = PERMISSIONS[to];
    if (permission && !principal.permissions.has(permission)) {
      throw new ForgeError("FORBIDDEN", `Missing permission ${permission} for transition to ${to}`);
    }
  }

  nextOnSubmit(from: NerisIncidentStatus): NerisIncidentStatus {
    if (from === "READY_FOR_REVIEW" || from === "IN_PROGRESS") {
      return "SUBMITTED_FOR_REVIEW";
    }
    throw new ForgeError("CONFLICT", `Cannot submit incident in status ${from}`);
  }

  nextOnReturn(): NerisIncidentStatus {
    return "RETURNED_FOR_CORRECTION";
  }

  nextOnApprove(): NerisIncidentStatus {
    return "APPROVED";
  }

  nextOnFinalize(): NerisIncidentStatus {
    return "FINALIZED";
  }

  nextOnVoid(): NerisIncidentStatus {
    return "VOIDED";
  }

  nextOnArchive(): NerisIncidentStatus {
    return "ARCHIVED";
  }
}
