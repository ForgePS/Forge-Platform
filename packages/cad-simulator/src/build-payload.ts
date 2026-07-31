import { createHash, randomBytes } from "node:crypto";
import { FORGE_CAD_HEADERS, signCadWebhookPayload } from "@forge/cad-core";
import { getCadSimulatorScenario, type CadSimulatorScenarioId } from "./scenarios.js";

export type BuildCadSimulatorPayloadInput = {
  scenarioId: CadSimulatorScenarioId | string;
  sourceIncidentId?: string;
  sourceIncidentNumber?: string;
  sourceSequence?: number;
  overrides?: Record<string, unknown>;
};

export function buildCadSimulatorPayload(
  input: BuildCadSimulatorPayloadInput,
): Record<string, unknown> {
  const scenario = getCadSimulatorScenario(input.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown CAD simulator scenario: ${input.scenarioId}`);
  }

  const now = new Date().toISOString();
  const sourceIncidentId =
    input.sourceIncidentId ?? `SIM-${randomBytes(4).toString("hex").toUpperCase()}`;
  const sourceSequence = input.sourceSequence ?? 1;
  const sourceMessageId = `msg_${randomBytes(8).toString("hex")}`;

  const base: Record<string, unknown> = {
    eventType: scenario.eventType,
    sourceMessageId,
    sourceEventId: `evt_${randomBytes(6).toString("hex")}`,
    sourceIncidentId,
    sourceIncidentNumber: input.sourceIncidentNumber ?? sourceIncidentId,
    sourceSequence,
    timestamp: now,
  };

  switch (scenario.id) {
    case "new-incident":
      Object.assign(base, {
        callType: "STRUCTURE_FIRE",
        priority: "1",
        address: "100 Main St",
        city: "Springfield",
        state: "IL",
        postalCode: "62701",
        latitude: 39.7817,
        longitude: -89.6501,
        units: [{ sourceUnitId: "E1", sourceUnitCallsign: "Engine 1", status: "DISPATCHED" }],
      });
      break;
    case "update-incident":
      Object.assign(base, {
        callType: "STRUCTURE_FIRE",
        priority: "1",
        address: "100 Main St",
        city: "Springfield",
        state: "IL",
      });
      break;
    case "unit-dispatched":
      Object.assign(base, {
        units: [{ sourceUnitId: "L2", sourceUnitCallsign: "Ladder 2", status: "DISPATCHED" }],
      });
      break;
    case "comment-added":
      Object.assign(base, {
        comments: [
          {
            sourceCommentId: `cmt_${randomBytes(4).toString("hex")}`,
            text: "Synthetic CAD comment from simulator",
            restricted: false,
          },
        ],
      });
      break;
    case "heartbeat":
    case "connection-test":
      break;
    default:
      break;
  }

  return { ...base, ...(input.overrides ?? {}) };
}

export type SignedCadSimulatorWebhook = {
  body: Buffer;
  bodySha256Hex: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
};

export function signCadSimulatorWebhook(input: {
  payload: Record<string, unknown>;
  secret: string;
  keyId: string;
  nowMs?: number;
}): SignedCadSimulatorWebhook {
  const body = Buffer.from(JSON.stringify(input.payload), "utf8");
  const bodySha256Hex = createHash("sha256").update(body).digest("hex");
  const timestamp = String(Math.floor((input.nowMs ?? Date.now()) / 1000));
  const nonce = randomBytes(12).toString("hex");
  const messageId =
    typeof input.payload.sourceMessageId === "string"
      ? input.payload.sourceMessageId
      : `msg_${randomBytes(8).toString("hex")}`;
  const signature = signCadWebhookPayload({
    secret: input.secret,
    timestamp,
    nonce,
    messageId,
    bodySha256Hex,
  });

  return {
    body,
    bodySha256Hex,
    payload: input.payload,
    headers: {
      "content-type": "application/json",
      [FORGE_CAD_HEADERS.KEY_ID]: input.keyId,
      [FORGE_CAD_HEADERS.TIMESTAMP]: timestamp,
      [FORGE_CAD_HEADERS.NONCE]: nonce,
      [FORGE_CAD_HEADERS.MESSAGE_ID]: messageId,
      [FORGE_CAD_HEADERS.SIGNATURE]: signature,
    },
  };
}
