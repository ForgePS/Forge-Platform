import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {
  createId,
  persons,
  rmsPersonnel,
  rmsTrainingCourses,
  withTenantTransaction,
} from "@forge/database";
import {eq} from "drizzle-orm";
import {E2eHarness} from "./testing/e2e-harness.js";

describe("RMS training and certification domain",()=>{
  const harness=new E2eHarness();
  beforeAll(async()=>{await harness.init()},360_000);
  afterAll(async()=>{await harness.cleanup();await harness.close()});

  async function createTrainingUser(tenantId:string){
    return harness.createUser({
      tenantId,
      email:`training-${createId()}@example.test`,
      roleCode:"RMS_TRAINING_MANAGER",
      rolePermissions:["rms.masterdata.read","rms.masterdata.manage"],
      moduleCodes:["CORE","NERIS"],
    });
  }

  async function createPersonnel(tenantId:string){
    return withTenantTransaction(harness.appDb,tenantId,async tx=>{
      const personId=createId();const personnelId=createId();const now=new Date();
      await tx.insert(persons).values({
        id:personId,tenantId,forgePersonNumber:`FP-${personId.slice(0,8)}`,
        firstName:"Taylor",lastName:"Responder",displayName:"Taylor Responder",
        status:"ACTIVE",recordSource:"MANUAL",createdAt:now,updatedAt:now,
      });
      await tx.insert(rmsPersonnel).values({
        id:personnelId,tenantId,personId,rank:"Firefighter",status:"ACTIVE",
        incidentEligible:true,createdAt:now,updatedAt:now,
      });
      return {personId,personnelId};
    });
  }

  it("computes readiness from required course and certification records",async()=>{
    const tenant=await harness.createTenant({moduleCodes:["CORE","NERIS"]});
    const user=await createTrainingUser(tenant.tenantId);
    const person=await createPersonnel(tenant.tenantId);
    const api=harness.api(user.userId,tenant.tenantId);

    const course=await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/training/courses`)
      .set("Idempotency-Key",createId())
      .send({code:"SCBA-ANNUAL",title:"Annual SCBA Competency",category:"OPERATIONS",defaultHours:2,recurrenceMonths:12,requiredForIncidentEligibility:true})
      .expect(200);

    const certType=await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/certifications/types`)
      .set("Idempotency-Key",createId())
      .send({code:"PARAMEDIC",name:"Paramedic",issuingAuthority:"State EMS",category:"EMS",requiredForIncidentEligibility:true})
      .expect(200);

    const before=await api.get(`/api/v1/tenants/${tenant.tenantId}/rms/training/readiness/${person.personnelId}`).expect(200);
    expect(before.body.data.eligible).toBe(false);
    expect(before.body.data.missingTraining).toHaveLength(1);
    expect(before.body.data.missingCertifications).toHaveLength(1);

    const completedAt="2026-10-01T12:00:00.000Z";
    const training=await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/training/records`)
      .set("Idempotency-Key",createId())
      .send({courseId:course.body.data.id,personnelId:person.personnelId,completedAt,status:"COMPLETED",instructor:"Training Officer"})
      .expect(200);
    expect(training.body.data.expiresAt).toBeTruthy();

    await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/certifications/personnel`)
      .set("Idempotency-Key",createId())
      .send({personnelId:person.personnelId,certificationTypeId:certType.body.data.id,credentialNumber:"P-1001",issuedAt:"2026-01-01",expiresAt:"2028-01-01",status:"ACTIVE",verifiedAt:"2026-10-01T12:00:00.000Z",verifiedBy:"Training Officer"})
      .expect(200);

    const after=await api.get(`/api/v1/tenants/${tenant.tenantId}/rms/training/readiness/${person.personnelId}`).expect(200);
    expect(after.body.data.eligible).toBe(true);
    expect(after.body.data.missingTraining).toHaveLength(0);
    expect(after.body.data.missingCertifications).toHaveLength(0);
  });

  it("enforces training tenant isolation through RLS",async()=>{
    const tenantA=await harness.createTenant({moduleCodes:["CORE","NERIS"]});
    const tenantB=await harness.createTenant({moduleCodes:["CORE","NERIS"]});
    const user=await createTrainingUser(tenantA.tenantId);
    const created=await harness.api(user.userId,tenantA.tenantId)
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/training/courses`)
      .set("Idempotency-Key",createId())
      .send({code:"ISO-COURSE",title:"Isolation Course"})
      .expect(200);
    await expect(withTenantTransaction(harness.appDb,tenantB.tenantId,async tx=>
      tx.query.rmsTrainingCourses.findFirst({where:eq(rmsTrainingCourses.id,created.body.data.id)})
    )).resolves.toBeUndefined();
  });
});
