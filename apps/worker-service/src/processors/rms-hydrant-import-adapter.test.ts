import { describe, expect, it } from "vitest";
import { RMS_HYDRANT_IMPORT_ADAPTER_KEY, RmsHydrantImportAdapter } from "./rms-hydrant-import-adapter.js";

describe("RMS hydrant import adapter contract",()=>{
  it("uses the registered production adapter key",()=>{
    expect(RMS_HYDRANT_IMPORT_ADAPTER_KEY).toBe("FORGE_RMS:HYDRANTS:hydrant@1");
  });

  it("rejects incompatible execution contexts before database work",async()=>{
    const adapter=new RmsHydrantImportAdapter({} as never);
    await expect(adapter.validateExecutionContext({
      tenantId:"tenant",jobId:"job",batchId:"batch",correlationId:"corr",
      productCode:"FORGE_INDUSTRIAL",moduleCode:"HYDRANTS",recordType:"hydrant",
      mappingSnapshot:[],workerId:"worker",attempt:1,
    })).rejects.toThrow("incompatible import context");
  });

  it("accepts only the RMS hydrant execution tuple",async()=>{
    const adapter=new RmsHydrantImportAdapter({} as never);
    await expect(adapter.validateExecutionContext({
      tenantId:"tenant",jobId:"job",batchId:"batch",correlationId:"corr",
      productCode:"FORGE_RMS",moduleCode:"HYDRANTS",recordType:"hydrant",
      mappingSnapshot:[],workerId:"worker",attempt:1,
    })).resolves.toBeUndefined();
  });
});
