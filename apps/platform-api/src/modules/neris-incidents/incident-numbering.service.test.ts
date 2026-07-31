import { describe, expect, it } from "vitest";
import { IncidentNumberingService } from "./incident-numbering.service.js";

describe("IncidentNumberingService.formatNumber", () => {
  const service = new IncidentNumberingService();
  const incidentDate = new Date("2026-07-26T12:00:00.000Z");

  it("formats prefix, year, and padded sequence tokens", () => {
    const formatted = service.formatNumber("{PREFIX}-{YEAR4}-{SEQ:4}-{SUFFIX}", {
      prefix: "FD",
      suffix: "X",
      incidentDate,
      sequence: 42,
    });
    expect(formatted).toBe("FD-2026-0042-X");
  });

  it("includes station and agency tokens", () => {
    const formatted = service.formatNumber("{AGENCY}-ST{STATION}-{YEAR2}{SEQ:3}", {
      agencyCode: "SVFD",
      stationNumber: "7",
      incidentDate,
      sequence: 9,
    });
    expect(formatted).toBe("SVFD-ST7-26009");
  });

  it("leaves unknown tokens empty", () => {
    const formatted = service.formatNumber("{UNKNOWN}-{SEQ:2}", {
      incidentDate,
      sequence: 1,
    });
    expect(formatted).toBe("-01");
  });
});

describe("IncidentNumberingService.checksumSnapshot", () => {
  const service = new IncidentNumberingService();

  it("returns stable sha256 hex for identical payloads", () => {
    const payload = { modules: [{ key: "mod_a", fields: [] }] };
    expect(service.checksumSnapshot(payload)).toBe(service.checksumSnapshot(payload));
    expect(service.checksumSnapshot(payload)).toMatch(/^[a-f0-9]{64}$/);
  });
});
