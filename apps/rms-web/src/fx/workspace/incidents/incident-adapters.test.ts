import { describe, expect, it } from "vitest";
import type { IncidentDetail } from "@/lib/rms-api";
import {
  adaptIncidentRelated,
  adaptIncidentSummary,
  adaptIncidentTimeline,
} from "./incident-adapters";

const incident: IncidentDetail = {
  id: "inc-1",
  incidentNumber: "2026-0001",
  status: "DRAFT",
  incidentDate: "2026-07-01",
  dispatchDescription: "Smoke showing",
  primaryIncidentTypeCode: "111",
  recordVersion: 1,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
  alarmAt: "2026-07-01T10:05:00.000Z",
  stationId: null,
  shiftId: null,
  responseDistrict: "North",
  incidentSource: null,
  mutualAidStatus: null,
  aidDirection: null,
  operatingMode: "STANDARD",
  reportOwnerUserId: "user-1",
  sections: [],
};

describe("incident adapters", () => {
  it("maps existing summary fields only", () => {
    const items = adaptIncidentSummary(incident);
    expect(items.find((i) => i.id === "number")?.value).toBe("2026-0001");
    expect(items.find((i) => i.id === "type")?.value).toBe("111");
    expect(items.find((i) => i.id === "district")?.value).toBe("North");
  });

  it("builds timeline from record timestamps", () => {
    const items = adaptIncidentTimeline(incident);
    expect(items.map((i) => i.id)).toEqual(["updated", "alarm", "created"]);
  });

  it("only relates existing section shortcuts", () => {
    expect(adaptIncidentRelated("inc-1", ["OVERVIEW"])).toEqual([]);
    expect(adaptIncidentRelated("inc-1", ["ATTACHMENTS", "REVIEW"]).map((i) => i.id)).toEqual([
      "attachments",
      "review",
    ]);
  });
});
