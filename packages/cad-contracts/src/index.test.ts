import { describe, expect, it } from "vitest";
import {
  CAD_FEATURE_FLAGS,
  CAD_INTAKE_MODES,
  CAD_TRANSPORT_IMPLEMENTATION_STATUS,
  createCadConnectionInputSchema,
  tenantCadConfigurationSchema,
} from "./index.js";

describe("CAD contracts", () => {
  it("keeps intake modes stable", () => {
    expect(CAD_INTAKE_MODES).toEqual(["MANUAL_ONLY", "CAD_ENABLED", "HYBRID"]);
  });

  it("labels unimplemented transports", () => {
    expect(CAD_TRANSPORT_IMPLEMENTATION_STATUS.SFTP).toBe("NOT_IMPLEMENTED");
    expect(CAD_TRANSPORT_IMPLEMENTATION_STATUS.HTTPS_WEBHOOK).toBe("IMPLEMENTED");
  });

  it("defaults feature flag keys", () => {
    expect(CAD_FEATURE_FLAGS.ENABLED).toBe("rms.cad.enabled");
    expect(CAD_FEATURE_FLAGS.ADAPTER_MANAGEMENT).toBe("platform.cad.adapter_management.enabled");
  });

  it("parses tenant CAD configuration defaults", () => {
    const parsed = tenantCadConfigurationSchema.parse({});
    expect(parsed.intakeMode).toBe("MANUAL_ONLY");
    expect(parsed.cadUpdateCutoffPolicy).toBe("UNTIL_FINALIZED");
  });

  it("rejects PRODUCTION-unsafe short polling interval", () => {
    const result = createCadConnectionInputSchema.safeParse({
      name: "Sim",
      vendor: "Forge",
      adapterKey: "forge.synthetic",
      adapterVersion: "1.0.0",
      environment: "SIMULATOR",
      transportType: "SYNTHETIC_SIMULATOR",
      pollingIntervalSeconds: 5,
    });
    expect(result.success).toBe(false);
  });
});
