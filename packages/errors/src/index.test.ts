import { describe, expect, it } from "vitest";
import { ForgeError, isForgeError } from "./index.js";

describe("ForgeError", () => {
  it("maps TENANT_SUSPENDED to 403", () => {
    const err = new ForgeError("TENANT_SUSPENDED", "Tenant suspended");
    expect(err.statusCode).toBe(403);
    expect(isForgeError(err)).toBe(true);
  });
});
