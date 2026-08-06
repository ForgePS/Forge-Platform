import { describe, expect, it } from "vitest";
import { DocumentStorageService } from "./document-storage.service.js";

describe("DocumentStorageService object keys", () => {
  it("scopes object keys by tenant and incident", () => {
    const service = Object.create(DocumentStorageService.prototype) as DocumentStorageService;
    const key = service.buildObjectKey("tenant-a", "incident-b", "uuid-file.pdf");
    expect(key).toBe("tenants/tenant-a/incidents/incident-b/documents/uuid-file.pdf");
    expect(key).not.toContain("tenant-b");
  });

  it("sanitizes stored filenames", () => {
    const service = Object.create(DocumentStorageService.prototype) as DocumentStorageService;
    const name = service.buildStoredFilename("../../evil name!!.pdf");
    expect(name).toMatch(/\.pdf$/);
    expect(name).not.toContain("..");
    expect(name).not.toContain(" ");
  });
});
