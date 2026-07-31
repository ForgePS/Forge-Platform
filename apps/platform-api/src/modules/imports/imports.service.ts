import { Inject, Injectable } from "@nestjs/common";
import {
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import {
  assertMalwareGate,
  createImportJobSchema,
  createImportProfileSchema,
  getImportTemplate,
  IMPORT_NOT_AVAILABLE_UNTIL_S3,
  IMPORT_NOT_AVAILABLE_UNTIL_S5,
  listImportTemplates,
  listJobsQuerySchema,
  listProfilesQuerySchema,
  nextStatusForAction,
  patchImportJobSchema,
  patchImportProfileSchema,
  putMappingsSchema,
  type ImportJobStatus,
} from "@forge/imports";
import type { ForgePrincipal } from "@forge/tenant-context";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { mapImportJob, mapImportMapping, mapImportProfile } from "./imports.mapper.js";
import { ImportsRepository } from "./imports.repository.js";

@Injectable()
export class ImportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repo: ImportsRepository,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  private requireTenant(principal: ForgePrincipal): string {
    if (!principal.tenantId) {
      throw new ForgeError("IMPORT_TENANT_CONTEXT_REQUIRED", "Tenant context is required.");
    }
    return principal.tenantId;
  }

  private mapStateError(error: unknown): never {
    const code = (error as { code?: string } | null)?.code;
    if (code === "IMPORT_INVALID_STATE_TRANSITION") {
      throw new ForgeError(
        "IMPORT_INVALID_STATE_TRANSITION",
        error instanceof Error ? error.message : "Invalid import state transition",
      );
    }
    if (code === "IMPORT_ENTITLEMENT_REQUIRED") {
      throw new ForgeError(
        "IMPORT_ENTITLEMENT_REQUIRED",
        "Active product/module entitlement is required for this import.",
      );
    }
    throw error;
  }

  async createJob(
    principal: ForgePrincipal,
    body: unknown,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    const tenantId = this.requireTenant(principal);
    const data = createImportJobSchema.parse(body);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          await this.repo.assertProductModuleEntitlement(
            tx,
            tenantId,
            data.productKey,
            data.moduleKey,
          );
          let profile = null;
          if (data.profileId) {
            profile = await this.repo.getProfile(tx, tenantId, data.profileId);
            if (!profile || profile.archivedAt) {
              throw new ForgeError("IMPORT_PROFILE_NOT_FOUND", "The import profile was not found.");
            }
          }
          const row = await this.repo.insertJob(tx, {
            tenantId,
            userId: principal.userId,
            correlationId,
            idempotencyKey: idempotencyKey ?? null,
            data,
            profile,
          });
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_job",
            aggregateId: row.id,
            eventType: DOMAIN_EVENT_TYPES.IMPORT_JOB_CREATED,
            correlationId,
            actorUserId: principal.userId,
            payload: {
              jobId: row.id,
              status: row.status,
              productKey: row.productCode,
              moduleKey: row.moduleCode,
              recordCategory: row.recordType,
            },
          });
          await this.audit.writeInTransaction(tx, {
            tenantId,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: "ImportJobCreated",
            resourceType: "import_job",
            resourceId: row.id,
            result: "SUCCESS",
            riskLevel: "LOW",
            correlationId,
            requestId: principal.requestId,
            after: { status: row.status, displayName: row.displayName },
          });
          return mapImportJob(row);
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  async listJobs(principal: ForgePrincipal, query: unknown) {
    const tenantId = this.requireTenant(principal);
    const parsed = listJobsQuerySchema.parse(query);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const { rows, total } = await this.repo.listJobs(tx, tenantId, parsed);
        return {
          items: rows.map(mapImportJob),
          page: parsed.page,
          pageSize: parsed.pageSize,
          total,
        };
      },
      principal.userId,
    );
  }

  async getJob(principal: ForgePrincipal, jobId: string) {
    const tenantId = this.requireTenant(principal);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const row = await this.repo.getJob(tx, tenantId, jobId);
        if (!row) {
          throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
        }
        return mapImportJob(row);
      },
      principal.userId,
    );
  }

  async patchJob(principal: ForgePrincipal, jobId: string, body: unknown, correlationId: string) {
    const tenantId = this.requireTenant(principal);
    const patch = patchImportJobSchema.parse(body);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          const job = await this.repo.getJob(tx, tenantId, jobId);
          if (!job) {
            throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
          }
          nextStatusForAction("update_metadata", job.status as ImportJobStatus);
          const row = await this.repo.updateJobMetadata(tx, job, patch, principal.userId);
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_job",
            aggregateId: row.id,
            eventType: DOMAIN_EVENT_TYPES.IMPORT_JOB_UPDATED,
            correlationId,
            actorUserId: principal.userId,
            payload: { jobId: row.id, status: row.status },
          });
          await this.audit.writeInTransaction(tx, {
            tenantId,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: "ImportJobUpdated",
            resourceType: "import_job",
            resourceId: row.id,
            result: "SUCCESS",
            riskLevel: "LOW",
            correlationId,
            requestId: principal.requestId,
            after: { displayName: row.displayName },
          });
          return mapImportJob(row);
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  async putMappings(
    principal: ForgePrincipal,
    jobId: string,
    body: unknown,
    correlationId: string,
  ) {
    const tenantId = this.requireTenant(principal);
    const data = putMappingsSchema.parse(body);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          const job = await this.repo.getJob(tx, tenantId, jobId);
          if (!job) {
            throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
          }
          const next = nextStatusForAction("replace_mappings", job.status as ImportJobStatus);
          const mappings = await this.repo.replaceMappings(tx, {
            tenantId,
            userId: principal.userId,
            jobId,
            profileId: job.profileId,
            correlationId,
            data,
          });
          const updated = await this.repo.updateJobStatus(
            tx,
            job,
            next,
            principal.userId,
            { currentStage: "MAPPED" },
          );
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_job",
            aggregateId: jobId,
            eventType: DOMAIN_EVENT_TYPES.IMPORT_MAPPINGS_UPDATED,
            correlationId,
            actorUserId: principal.userId,
            payload: { jobId, mappingCount: mappings.length, status: updated.status },
          });
          await this.audit.writeInTransaction(tx, {
            tenantId,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: "ImportMappingsUpdated",
            resourceType: "import_job",
            resourceId: jobId,
            result: "SUCCESS",
            riskLevel: "LOW",
            correlationId,
            requestId: principal.requestId,
            after: { mappingCount: mappings.length },
          });
          return {
            job: mapImportJob(updated),
            mappings: mappings.map(mapImportMapping),
          };
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  async listMappings(principal: ForgePrincipal, jobId: string) {
    const tenantId = this.requireTenant(principal);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const job = await this.repo.getJob(tx, tenantId, jobId);
        if (!job) {
          throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
        }
        const rows = await this.repo.listMappings(tx, tenantId, jobId);
        return { items: rows.map(mapImportMapping) };
      },
      principal.userId,
    );
  }

  async deleteMapping(
    principal: ForgePrincipal,
    jobId: string,
    mappingId: string,
    correlationId: string,
  ) {
    const tenantId = this.requireTenant(principal);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          const job = await this.repo.getJob(tx, tenantId, jobId);
          if (!job) {
            throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
          }
          nextStatusForAction("replace_mappings", job.status as ImportJobStatus);
          const deleted = await this.repo.deleteMapping(tx, tenantId, jobId, mappingId);
          if (!deleted) {
            throw new ForgeError("IMPORT_MAPPING_INVALID", "The mapping was not found.");
          }
          const remaining = await this.repo.countMappings(tx, tenantId, jobId);
          const nextStatus =
            remaining === 0 ? ("READY_FOR_MAPPING" as const) : ("MAPPED" as const);
          const updated = await this.repo.updateJobStatus(tx, job, nextStatus, principal.userId);
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_job",
            aggregateId: jobId,
            eventType: DOMAIN_EVENT_TYPES.IMPORT_MAPPINGS_UPDATED,
            correlationId,
            actorUserId: principal.userId,
            payload: { jobId, mappingCount: remaining, deletedMappingId: mappingId },
          });
          return { job: mapImportJob(updated), deletedMappingId: mappingId };
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  private async transitionLifecycle(
    principal: ForgePrincipal,
    jobId: string,
    correlationId: string,
    action:
      | "cancel"
      | "submit_for_approval"
      | "approve"
      | "reject",
    auditAction: string,
    eventType: string,
  ) {
    const tenantId = this.requireTenant(principal);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          const job = await this.repo.getJob(tx, tenantId, jobId);
          if (!job) {
            throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
          }
          if (action === "approve" || action === "submit_for_approval") {
            const file = await this.repo.getFileForJob(tx, tenantId, jobId);
            if (file) {
              const gate = assertMalwareGate({
                verdict: file.malwareVerdict,
                securityHold: file.securityHold || job.securityHold,
                contentHash: file.contentHash,
                verdictHash: file.verdictHash,
                quarantineStatus: file.quarantineStatus,
              });
              if (!gate.ok) {
                throw new ForgeError(
                  gate.code as
                    | "IMPORT_SCAN_REQUIRED"
                    | "IMPORT_SCAN_PENDING"
                    | "IMPORT_SCAN_FAILED"
                    | "IMPORT_SCAN_TIMEOUT"
                    | "IMPORT_SCAN_INFECTED"
                    | "IMPORT_SCAN_SUSPICIOUS"
                    | "IMPORT_SCAN_HASH_MISMATCH"
                    | "IMPORT_SCAN_STALE_VERDICT"
                    | "IMPORT_FILE_QUARANTINED"
                    | "IMPORT_SECURITY_HOLD",
                  gate.message,
                );
              }
            }
          }
          const next = nextStatusForAction(action, job.status as ImportJobStatus);
          const extras =
            action === "approve"
              ? { approvedAt: new Date(), approvedBy: principal.userId }
              : action === "reject"
                ? { approvedAt: null, approvedBy: null }
                : {};
          const row = await this.repo.updateJobStatus(
            tx,
            job,
            next,
            principal.userId,
            extras,
          );
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_job",
            aggregateId: jobId,
            eventType,
            correlationId,
            actorUserId: principal.userId,
            payload: { jobId, fromStatus: job.status, toStatus: row.status },
          });
          await this.audit.writeInTransaction(tx, {
            tenantId,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: auditAction,
            resourceType: "import_job",
            resourceId: jobId,
            result: "SUCCESS",
            riskLevel: action === "approve" ? "MEDIUM" : "LOW",
            correlationId,
            requestId: principal.requestId,
            after: { status: row.status },
          });
          return mapImportJob(row);
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  cancelJob(principal: ForgePrincipal, jobId: string, correlationId: string) {
    return this.transitionLifecycle(
      principal,
      jobId,
      correlationId,
      "cancel",
      "ImportJobCancelled",
      DOMAIN_EVENT_TYPES.IMPORT_JOB_CANCELLED,
    );
  }

  submitForApproval(principal: ForgePrincipal, jobId: string, correlationId: string) {
    return this.transitionLifecycle(
      principal,
      jobId,
      correlationId,
      "submit_for_approval",
      "ImportSubmittedForApproval",
      DOMAIN_EVENT_TYPES.IMPORT_SUBMITTED_FOR_APPROVAL,
    );
  }

  approveJob(principal: ForgePrincipal, jobId: string, correlationId: string) {
    return this.transitionLifecycle(
      principal,
      jobId,
      correlationId,
      "approve",
      "ImportApproved",
      DOMAIN_EVENT_TYPES.IMPORT_APPROVED,
    );
  }

  rejectJob(principal: ForgePrincipal, jobId: string, correlationId: string) {
    return this.transitionLifecycle(
      principal,
      jobId,
      correlationId,
      "reject",
      "ImportRejected",
      DOMAIN_EVENT_TYPES.IMPORT_REJECTED,
    );
  }

  async requestValidation(principal: ForgePrincipal, jobId: string, correlationId: string) {
    const tenantId = this.requireTenant(principal);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          const job = await this.repo.getJob(tx, tenantId, jobId);
          if (!job) {
            throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
          }
          nextStatusForAction("request_validation", job.status as ImportJobStatus);
          const mappingCount = await this.repo.countMappings(tx, tenantId, jobId);
          if (mappingCount < 1) {
            throw new ForgeError(
              "IMPORT_VALIDATION_REQUEST_NOT_AVAILABLE",
              "Mappings are required before requesting validation.",
            );
          }
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_job",
            aggregateId: jobId,
            eventType: DOMAIN_EVENT_TYPES.IMPORT_VALIDATION_REQUESTED,
            correlationId,
            actorUserId: principal.userId,
            payload: {
              jobId,
              status: job.status,
              availability: IMPORT_NOT_AVAILABLE_UNTIL_S5,
            },
          });
          await this.audit.writeInTransaction(tx, {
            tenantId,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: "ImportValidationRequested",
            resourceType: "import_job",
            resourceId: jobId,
            result: "SUCCESS",
            riskLevel: "LOW",
            correlationId,
            requestId: principal.requestId,
            after: { availability: IMPORT_NOT_AVAILABLE_UNTIL_S5 },
          });
          return {
            jobId,
            status: job.status,
            requestStatus: IMPORT_NOT_AVAILABLE_UNTIL_S5,
            message:
              "Validation orchestration accepted for audit only. Row-level validation workers are not available until Sprint S5.",
          };
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  async requestPreview(principal: ForgePrincipal, jobId: string, correlationId: string) {
    const tenantId = this.requireTenant(principal);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          const job = await this.repo.getJob(tx, tenantId, jobId);
          if (!job) {
            throw new ForgeError("IMPORT_JOB_NOT_FOUND", "The import job was not found.");
          }
          nextStatusForAction("request_preview", job.status as ImportJobStatus);
          const mappingCount = await this.repo.countMappings(tx, tenantId, jobId);
          if (mappingCount < 1) {
            throw new ForgeError(
              "IMPORT_PREVIEW_REQUEST_NOT_AVAILABLE",
              "Mappings are required before requesting preview.",
            );
          }
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_job",
            aggregateId: jobId,
            eventType: DOMAIN_EVENT_TYPES.IMPORT_PREVIEW_REQUESTED,
            correlationId,
            actorUserId: principal.userId,
            payload: {
              jobId,
              status: job.status,
              availability: IMPORT_NOT_AVAILABLE_UNTIL_S5,
            },
          });
          await this.audit.writeInTransaction(tx, {
            tenantId,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: "ImportPreviewRequested",
            resourceType: "import_job",
            resourceId: jobId,
            result: "SUCCESS",
            riskLevel: "LOW",
            correlationId,
            requestId: principal.requestId,
            after: { availability: IMPORT_NOT_AVAILABLE_UNTIL_S5 },
          });
          return {
            jobId,
            status: job.status,
            requestStatus: IMPORT_NOT_AVAILABLE_UNTIL_S5,
            message:
              "Preview orchestration accepted for audit only. Preview generation is not available until Sprint S5.",
          };
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  async createProfile(
    principal: ForgePrincipal,
    body: unknown,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    const tenantId = this.requireTenant(principal);
    const data = createImportProfileSchema.parse(body);
    try {
      return await withTenantTransaction(
        this.db,
        tenantId,
        async (tx) => {
          await this.repo.assertProductModuleEntitlement(
            tx,
            tenantId,
            data.productKey,
            data.moduleKey,
          );
          const row = await this.repo.insertProfile(tx, {
            tenantId,
            userId: principal.userId,
            correlationId,
            idempotencyKey: idempotencyKey ?? null,
            data,
          });
          await this.outbox.write(tx, {
            tenantId,
            aggregateType: "import_profile",
            aggregateId: row.id,
            eventType: DOMAIN_EVENT_TYPES.IMPORT_PROFILE_CREATED,
            correlationId,
            actorUserId: principal.userId,
            payload: {
              profileId: row.id,
              profileKey: row.profileKey,
              productKey: row.productCode,
            },
          });
          await this.audit.writeInTransaction(tx, {
            tenantId,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: "ImportProfileCreated",
            resourceType: "import_profile",
            resourceId: row.id,
            result: "SUCCESS",
            riskLevel: "LOW",
            correlationId,
            requestId: principal.requestId,
            after: { profileKey: row.profileKey },
          });
          return mapImportProfile(row);
        },
        principal.userId,
      );
    } catch (error) {
      this.mapStateError(error);
    }
  }

  async listProfiles(principal: ForgePrincipal, query: unknown) {
    const tenantId = this.requireTenant(principal);
    const parsed = listProfilesQuerySchema.parse(query);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const { rows, total } = await this.repo.listProfiles(tx, tenantId, parsed);
        return {
          items: rows.map(mapImportProfile),
          page: parsed.page,
          pageSize: parsed.pageSize,
          total,
        };
      },
      principal.userId,
    );
  }

  async getProfile(principal: ForgePrincipal, profileId: string) {
    const tenantId = this.requireTenant(principal);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const row = await this.repo.getProfile(tx, tenantId, profileId);
        if (!row) {
          throw new ForgeError("IMPORT_PROFILE_NOT_FOUND", "The import profile was not found.");
        }
        return mapImportProfile(row);
      },
      principal.userId,
    );
  }

  async patchProfile(
    principal: ForgePrincipal,
    profileId: string,
    body: unknown,
    correlationId: string,
  ) {
    const tenantId = this.requireTenant(principal);
    const patch = patchImportProfileSchema.parse(body);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const profile = await this.repo.getProfile(tx, tenantId, profileId);
        if (!profile || profile.archivedAt) {
          throw new ForgeError("IMPORT_PROFILE_NOT_FOUND", "The import profile was not found.");
        }
        const row = await this.repo.updateProfile(tx, profile, patch, principal.userId);
        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "import_profile",
          aggregateId: row.id,
          eventType: DOMAIN_EVENT_TYPES.IMPORT_PROFILE_UPDATED,
          correlationId,
          actorUserId: principal.userId,
          payload: { profileId: row.id, profileKey: row.profileKey },
        });
        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "ImportProfileUpdated",
          resourceType: "import_profile",
          resourceId: row.id,
          result: "SUCCESS",
          riskLevel: "LOW",
          correlationId,
          requestId: principal.requestId,
          after: { displayName: row.displayName },
        });
        return mapImportProfile(row);
      },
      principal.userId,
    );
  }

  async archiveProfile(principal: ForgePrincipal, profileId: string, correlationId: string) {
    const tenantId = this.requireTenant(principal);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const profile = await this.repo.getProfile(tx, tenantId, profileId);
        if (!profile) {
          throw new ForgeError("IMPORT_PROFILE_NOT_FOUND", "The import profile was not found.");
        }
        if (profile.archivedAt) {
          return mapImportProfile(profile);
        }
        const row = await this.repo.archiveProfile(tx, profile, principal.userId);
        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "import_profile",
          aggregateId: row.id,
          eventType: DOMAIN_EVENT_TYPES.IMPORT_PROFILE_ARCHIVED,
          correlationId,
          actorUserId: principal.userId,
          payload: { profileId: row.id },
        });
        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "ImportProfileArchived",
          resourceType: "import_profile",
          resourceId: row.id,
          result: "SUCCESS",
          riskLevel: "LOW",
          correlationId,
          requestId: principal.requestId,
        });
        return mapImportProfile(row);
      },
      principal.userId,
    );
  }

  async restoreProfile(principal: ForgePrincipal, profileId: string, correlationId: string) {
    const tenantId = this.requireTenant(principal);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const profile = await this.repo.getProfile(tx, tenantId, profileId);
        if (!profile) {
          throw new ForgeError("IMPORT_PROFILE_NOT_FOUND", "The import profile was not found.");
        }
        const row = await this.repo.restoreProfile(tx, profile, principal.userId);
        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "import_profile",
          aggregateId: row.id,
          eventType: DOMAIN_EVENT_TYPES.IMPORT_PROFILE_RESTORED,
          correlationId,
          actorUserId: principal.userId,
          payload: { profileId: row.id },
        });
        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "ImportProfileRestored",
          resourceType: "import_profile",
          resourceId: row.id,
          result: "SUCCESS",
          riskLevel: "LOW",
          correlationId,
          requestId: principal.requestId,
        });
        return mapImportProfile(row);
      },
      principal.userId,
    );
  }

  listTemplates(query: Record<string, string | undefined>) {
    const filters: { productKey?: string; moduleKey?: string; recordCategory?: string } = {};
    if (query.productKey) filters.productKey = query.productKey;
    if (query.moduleKey) filters.moduleKey = query.moduleKey;
    if (query.recordCategory) filters.recordCategory = query.recordCategory;
    return { items: listImportTemplates(filters) };
  }

  getTemplate(templateKey: string) {
    const template = getImportTemplate(templateKey);
    if (!template) {
      throw new ForgeError("IMPORT_TEMPLATE_NOT_FOUND", "The import template was not found.");
    }
    return template;
  }
}
