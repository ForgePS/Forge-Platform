import { describe, expect, it } from "vitest";
import { createCorrelationId, redactSensitive } from "./index.js";

describe("security", () => {
  it("redacts ssn-like keys", () => {
    const result = redactSensitive({ ssn: "123-45-6789", name: "Test" });
    expect(result).toEqual({ ssn: "[REDACTED]", name: "Test" });
  });

  it("redacts authorization headers", () => {
    const result = redactSensitive({ authorization: "Bearer secret", ok: true });
    expect(result).toEqual({ authorization: "[REDACTED]", ok: true });
  });

  it("generates correlation ids", () => {
    expect(createCorrelationId()).toMatch(/^[a-f0-9]{32}$/);
  });
});
