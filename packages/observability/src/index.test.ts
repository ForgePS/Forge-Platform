import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./index.js";

describe("observability", () => {
  it("redacts sensitive fields in log output", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logger = createLogger({ service: "test", environment: "local" }, { level: "debug" });
    logger.info("checking", { ssn: "111-22-3333", ok: true });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("[REDACTED]");
    expect(line).not.toContain("111-22-3333");
    spy.mockRestore();
  });
});
