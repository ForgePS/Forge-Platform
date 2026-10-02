import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {createId,persons,rmsPersonnel,rmsScheduleAssignments,withTenantTransaction} from "@forge/database";
import {eq} from "drizzle-orm";
import {E2eHarness} from "./testing/e2e-harness.js";

describe("RMS scheduling domain",()=>{
  const harness=new E2eHarness();
  beforeAll(async()=>{await harness.init()},360_000);
  afterAll(async()=>{await harness.cleanup();await harness.close()});

  async function createManager(tenantId:string){
    return harness.createUser({tenantId,email:`schedule-${createId()}@example.test`,roleCode:"RMS_SCHEDULER",rolePermissions:["rms.masterdata.read","rms.masterdata.manage"],moduleCodes:["CORE","NERIS"]});
  }
  async function createPersonnel(tenantId:string){
    return withTenantTransaction(harness.appDb,tenantId,async tx=>{
      const personId=createId(),personnelId=createId(),now=new Date();
      await tx.insert(persons).values({id:personId,tenantId,forgePersonNumber:`FP-${personId.slice(0,8)}`,firstName:"Jordan",lastName:"Schedule",displayName:"Jordan Schedule",status:"ACTIVE",recordSource:"MANUAL",createdAt:now,updatedAt:now});
      await tx.insert(rmsPersonnel).values({id:personnelId,tenantId,personId,rank:"Firefighter",status:"ACTIVE",incidentEligible:true,createdAt:now,updatedAt:now});
      return personnelId;
    });
  }

  it("captures readiness warnings and rejects overlapping assignments",async()=>{
    const tenant=await harness.createTenant({moduleCodes:["CORE","NERIS"]});
    const user=await createManager(tenant.tenantId);
    const personnelId=await createPersonnel(tenant.tenantId);
    const api=harness.api(user.userId,tenant.tenantId);

    await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/training/courses`)
      .set("Idempotency-Key",createId())
      .send({code:"ANNUAL-OPS",title:"Annual Operations",requiredForIncidentEligibility:true,recurrenceMonths:12})
      .expect(200);

    const first=await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/scheduling/assignments`)
      .set("Idempotency-Key",createId())
      .send({personnelId,startAt:"2026-10-03T12:00:00.000Z",endAt:"2026-10-04T00:00:00.000Z",assignmentType:"DUTY",role:"MEMBER"})
      .expect(200);

    expect(first.body.data.eligibilityStatus).toBe("NOT_READY");
    expect(first.body.data.eligibilityWarningsJson).toEqual(expect.arrayContaining([expect.stringContaining("ANNUAL-OPS")]));

    await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/scheduling/assignments`)
      .set("Idempotency-Key",createId())
      .send({personnelId,startAt:"2026-10-03T18:00:00.000Z",endAt:"2026-10-04T06:00:00.000Z",assignmentType:"OVERTIME"})
      .expect(res=>{expect(res.status).toBeGreaterThanOrEqual(400)});
  });

  it("blocks new assignments that overlap approved time off",async()=>{
    const tenant=await harness.createTenant({moduleCodes:["CORE","NERIS"]});
    const user=await createManager(tenant.tenantId);
    const personnelId=await createPersonnel(tenant.tenantId);
    const api=harness.api(user.userId,tenant.tenantId);

    await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/scheduling/time-off`)
      .set("Idempotency-Key",createId())
      .send({personnelId,startAt:"2026-10-10T12:00:00.000Z",endAt:"2026-10-11T12:00:00.000Z",leaveType:"VACATION",status:"APPROVED",reviewer:"Scheduling Officer"})
      .expect(200);

    await api.post(`/api/v1/tenants/${tenant.tenantId}/rms/scheduling/assignments`)
      .set("Idempotency-Key",createId())
      .send({personnelId,startAt:"2026-10-10T18:00:00.000Z",endAt:"2026-10-11T06:00:00.000Z"})
      .expect(res=>{expect(res.status).toBeGreaterThanOrEqual(400)});
  });

  it("enforces schedule tenant isolation through RLS",async()=>{
    const tenantA=await harness.createTenant({moduleCodes:["CORE","NERIS"]});
    const tenantB=await harness.createTenant({moduleCodes:["CORE","NERIS"]});
    const user=await createManager(tenantA.tenantId);
    const personnelId=await createPersonnel(tenantA.tenantId);
    const created=await harness.api(user.userId,tenantA.tenantId)
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/scheduling/assignments`)
      .set("Idempotency-Key",createId())
      .send({personnelId,startAt:"2026-10-20T12:00:00.000Z",endAt:"2026-10-20T20:00:00.000Z"})
      .expect(200);

    await expect(withTenantTransaction(harness.appDb,tenantB.tenantId,async tx=>
      tx.query.rmsScheduleAssignments.findFirst({where:eq(rmsScheduleAssignments.id,created.body.data.id)})
    )).resolves.toBeUndefined();
  });
});
