import { describe, expect, it } from "vitest";
import { buildAuditRecord, maskSensitiveValue } from "./index.js";

describe("audit", () => {
  it("redacts sensitive keys in snapshots", () => {
    const record = buildAuditRecord({
      id: "1",
      tenantId: "t",
      actorUserId: "u",
      actorPersonId: null,
      actorType: "USER",
      action: "person.update",
      resourceType: "person",
      result: "SUCCESS",
      riskLevel: "MEDIUM",
      correlationId: "c",
      requestId: "r",
      after: { password: "secret", name: "Ada" },
    });
    expect(JSON.stringify(record.afterJson)).not.toContain("secret");
  });

  it("masks SSN", () => {
    expect(maskSensitiveValue("SSN", "123456789")).toBe("***-**-6789");
  });
});
