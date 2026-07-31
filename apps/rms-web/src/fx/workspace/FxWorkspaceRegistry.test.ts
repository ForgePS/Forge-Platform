import { describe, expect, it, beforeEach } from "vitest";
import {
  clearWorkspaceRegistryForTests,
  getWorkspace,
  listWorkspaces,
  registerWorkspace,
} from "./FxWorkspaceRegistry";
import { isWorkspaceAuthorized, filterAuthorizedTabs } from "./WorkspacePermissions";
import { RMS_FX_WORKSPACE_FLAG } from "./workspace-flags";
import type { WorkspaceDefinition } from "./types";

const StubLayout: WorkspaceDefinition["Layout"] = () => null;

function sampleWorkspace(id = "test-ws"): WorkspaceDefinition {
  return {
    id,
    recordType: "incident",
    title: "Test",
    featureFlag: RMS_FX_WORKSPACE_FLAG,
    supportedTabs: [
      { id: "OVERVIEW", label: "Overview" },
      { id: "SECRET", label: "Secret", permissions: ["rms.secret.read"] },
    ],
    Layout: StubLayout,
  };
}

describe("FxWorkspaceRegistry", () => {
  beforeEach(() => {
    clearWorkspaceRegistryForTests();
  });

  it("registers and lists workspaces", () => {
    registerWorkspace(sampleWorkspace());
    expect(listWorkspaces()).toHaveLength(1);
    expect(getWorkspace("test-ws")?.title).toBe("Test");
  });

  it("rejects duplicate ids", () => {
    registerWorkspace(sampleWorkspace());
    expect(() => registerWorkspace(sampleWorkspace())).toThrow(/already registered/);
  });
});

describe("WorkspacePermissions", () => {
  const def = sampleWorkspace();

  it("requires auth, tenant, and workspace flag", () => {
    expect(
      isWorkspaceAuthorized(def, {
        authenticated: true,
        tenantId: "t1",
        workspaceFlagEnabled: false,
      }),
    ).toBe(false);
    expect(
      isWorkspaceAuthorized(def, {
        authenticated: true,
        tenantId: "t1",
        workspaceFlagEnabled: true,
      }),
    ).toBe(true);
  });

  it("filters tabs by permission", () => {
    const tabs = filterAuthorizedTabs(def.supportedTabs, {
      permissionCodes: [],
    });
    expect(tabs.map((t) => t.id)).toEqual(["OVERVIEW"]);
  });
});
