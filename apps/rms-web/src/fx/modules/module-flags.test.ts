import { describe, expect, it } from "vitest";
import {
  resolveAdministrationModulePresentation,
  resolveCadConflictsModulePresentation,
  resolveCadConnectionsModulePresentation,
  resolveCadMessagesModulePresentation,
  resolveIncidentModulePresentation,
  resolveIncidentReviewModulePresentation,
  resolveNerisConfigurationModulePresentation,
  resolveRmsFxModuleFlag,
  resolveUtilitiesModulePresentation,
} from "./module-flags";

describe("resolveRmsFxModuleFlag", () => {
  it("defaults off", () => {
    expect(resolveRmsFxModuleFlag({ apiEnabled: undefined, isPlatformAdmin: false })).toBe(false);
  });

  it("ignores platform admin wildcard", () => {
    expect(resolveRmsFxModuleFlag({ apiEnabled: true, isPlatformAdmin: true })).toBe(false);
  });

  it("enables for tenant flag", () => {
    expect(resolveRmsFxModuleFlag({ apiEnabled: true, isPlatformAdmin: false })).toBe(true);
  });

  it("honors env override", () => {
    expect(
      resolveRmsFxModuleFlag({
        apiEnabled: false,
        isPlatformAdmin: true,
        envOverride: "true",
      }),
    ).toBe(true);
  });
});

describe("resolveIncidentModulePresentation", () => {
  it("forces legacy when module off even if foundations on", () => {
    const result = resolveIncidentModulePresentation({
      moduleEnabled: false,
      tablesEnabled: true,
      formsEnabled: true,
      workspaceEnabled: true,
    });
    expect(result.list).toBe("legacy");
    expect(result.newForm).toBe("legacy");
    expect(result.workspace).toBe("legacy");
    expect(result.reasons.list).toBe("module-off");
  });

  it("uses FX only when module and foundation are on", () => {
    const result = resolveIncidentModulePresentation({
      moduleEnabled: true,
      tablesEnabled: true,
      formsEnabled: false,
      workspaceEnabled: true,
    });
    expect(result.list).toBe("fx");
    expect(result.newForm).toBe("legacy");
    expect(result.workspace).toBe("fx");
    expect(result.reasons.newForm).toBe("module-on-forms-off-compat");
  });

  it("never forces foundation flags — module alone stays legacy surfaces", () => {
    const result = resolveIncidentModulePresentation({
      moduleEnabled: true,
      tablesEnabled: false,
      formsEnabled: false,
      workspaceEnabled: false,
    });
    expect(result.moduleEnabled).toBe(true);
    expect(result.list).toBe("legacy");
    expect(result.newForm).toBe("legacy");
    expect(result.workspace).toBe("legacy");
  });
});

describe("resolveIncidentReviewModulePresentation", () => {
  it("forces legacy when review module off even if foundations on", () => {
    const result = resolveIncidentReviewModulePresentation({
      moduleEnabled: false,
      tablesEnabled: true,
      formsEnabled: true,
    });
    expect(result.queue).toBe("legacy");
    expect(result.detailForms).toBe("legacy");
  });

  it("uses FX queue/forms only when module and foundations are on", () => {
    const result = resolveIncidentReviewModulePresentation({
      moduleEnabled: true,
      tablesEnabled: true,
      formsEnabled: false,
    });
    expect(result.queue).toBe("fx");
    expect(result.detailForms).toBe("legacy");
    expect(result.reasons.detailForms).toBe("module-on-forms-off-compat");
  });
});

describe("resolveCadMessagesModulePresentation", () => {
  it("forces legacy when cad messages module off even if tables on", () => {
    expect(
      resolveCadMessagesModulePresentation({
        moduleEnabled: false,
        tablesEnabled: true,
      }).list,
    ).toBe("legacy");
  });

  it("uses FX list only when module and tables are on", () => {
    const on = resolveCadMessagesModulePresentation({
      moduleEnabled: true,
      tablesEnabled: true,
    });
    expect(on.list).toBe("fx");
    expect(on.reasons.list).toBe("module+tables");

    const compat = resolveCadMessagesModulePresentation({
      moduleEnabled: true,
      tablesEnabled: false,
    });
    expect(compat.list).toBe("legacy");
    expect(compat.reasons.list).toBe("module-on-tables-off-compat");
  });
});

describe("resolveCadConnectionsModulePresentation", () => {
  it("forces legacy when cad connections module off even if foundations on", () => {
    const result = resolveCadConnectionsModulePresentation({
      moduleEnabled: false,
      formsEnabled: true,
      tablesEnabled: true,
    });
    expect(result.createForm).toBe("legacy");
    expect(result.list).toBe("legacy");
    expect(result.reasons.createForm).toBe("module-off");
    expect(result.reasons.list).toBe("module-off");
  });

  it("uses FX create/list only when module and foundations are on", () => {
    const on = resolveCadConnectionsModulePresentation({
      moduleEnabled: true,
      formsEnabled: true,
      tablesEnabled: true,
    });
    expect(on.createForm).toBe("fx");
    expect(on.list).toBe("fx");
    expect(on.reasons.createForm).toBe("module+forms");
    expect(on.reasons.list).toBe("module+tables");

    const formsOnly = resolveCadConnectionsModulePresentation({
      moduleEnabled: true,
      formsEnabled: true,
      tablesEnabled: false,
    });
    expect(formsOnly.createForm).toBe("fx");
    expect(formsOnly.list).toBe("legacy");
    expect(formsOnly.reasons.list).toBe("module-on-tables-off-compat");

    const tablesOnly = resolveCadConnectionsModulePresentation({
      moduleEnabled: true,
      formsEnabled: false,
      tablesEnabled: true,
    });
    expect(tablesOnly.createForm).toBe("legacy");
    expect(tablesOnly.list).toBe("fx");
    expect(tablesOnly.reasons.createForm).toBe("module-on-forms-off-compat");
  });
});

describe("resolveCadConflictsModulePresentation", () => {
  it("forces legacy when cad conflicts module off even if tables on", () => {
    expect(
      resolveCadConflictsModulePresentation({
        moduleEnabled: false,
        tablesEnabled: true,
      }).list,
    ).toBe("legacy");
  });

  it("uses FX list only when module and tables are on", () => {
    const on = resolveCadConflictsModulePresentation({
      moduleEnabled: true,
      tablesEnabled: true,
    });
    expect(on.list).toBe("fx");
    expect(on.reasons.list).toBe("module+tables");

    const compat = resolveCadConflictsModulePresentation({
      moduleEnabled: true,
      tablesEnabled: false,
    });
    expect(compat.list).toBe("legacy");
    expect(compat.reasons.list).toBe("module-on-tables-off-compat");
  });
});

describe("resolveNerisConfigurationModulePresentation", () => {
  it("forces legacy when neris configuration module off even if forms on", () => {
    expect(
      resolveNerisConfigurationModulePresentation({
        moduleEnabled: false,
        formsEnabled: true,
      }).forms,
    ).toBe("legacy");
  });

  it("uses FX forms only when module and forms are on", () => {
    const on = resolveNerisConfigurationModulePresentation({
      moduleEnabled: true,
      formsEnabled: true,
    });
    expect(on.forms).toBe("fx");
    expect(on.reasons.forms).toBe("module+forms");

    const compat = resolveNerisConfigurationModulePresentation({
      moduleEnabled: true,
      formsEnabled: false,
    });
    expect(compat.forms).toBe("legacy");
    expect(compat.reasons.forms).toBe("module-on-forms-off-compat");
  });
});

describe("resolveAdministrationModulePresentation", () => {
  it("forces legacy when administration module off even if tables on", () => {
    expect(
      resolveAdministrationModulePresentation({
        moduleEnabled: false,
        tablesEnabled: true,
      }).selectTenant,
    ).toBe("legacy");
  });

  it("uses FX select-tenant only when module and tables are on", () => {
    const on = resolveAdministrationModulePresentation({
      moduleEnabled: true,
      tablesEnabled: true,
    });
    expect(on.selectTenant).toBe("fx");
    expect(on.reasons.selectTenant).toBe("module+tables");

    const compat = resolveAdministrationModulePresentation({
      moduleEnabled: true,
      tablesEnabled: false,
    });
    expect(compat.selectTenant).toBe("legacy");
    expect(compat.reasons.selectTenant).toBe("module-on-tables-off-compat");
  });
});

describe("resolveUtilitiesModulePresentation", () => {
  it("forces legacy when utilities module off", () => {
    expect(resolveUtilitiesModulePresentation({ moduleEnabled: false }).health).toBe("legacy");
  });

  it("uses FX health when utilities module on (no foundation required)", () => {
    const on = resolveUtilitiesModulePresentation({ moduleEnabled: true });
    expect(on.health).toBe("fx");
    expect(on.reasons.health).toBe("module-on");
  });
});
