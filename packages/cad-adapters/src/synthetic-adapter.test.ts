import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FORGE_CAD_HEADERS, signCadWebhookPayload } from "@forge/cad-core";
import { ForgeSyntheticCadAdapter } from "./synthetic-adapter.js";

describe("ForgeSyntheticCadAdapter", () => {
  const adapter = new ForgeSyntheticCadAdapter();
  const secret = "synth-secret";
  const bodyObj = {
    eventType: "INCIDENT_CREATED",
    sourceIncidentId: "CAD-100",
    sourceIncidentNumber: "2026-0001",
    timestamp: "2026-07-27T12:00:00.000Z",
    callType: "STRUCTURE_FIRE",
    address: "100 Main St",
  };
  const body = Buffer.from(JSON.stringify(bodyObj), "utf8");
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = "nonce-1";
  const messageId = "msg-1";
  const signature = signCadWebhookPayload({
    secret,
    timestamp,
    nonce,
    messageId,
    bodySha256Hex: bodyHash,
  });

  it("authenticates valid HMAC", async () => {
    const result = await adapter.authenticateMessage(
      {
        method: "POST",
        path: "/api/v1/cad/webhooks/pub",
        headers: {
          [FORGE_CAD_HEADERS.KEY_ID]: "k1",
          [FORGE_CAD_HEADERS.TIMESTAMP]: timestamp,
          [FORGE_CAD_HEADERS.NONCE]: nonce,
          [FORGE_CAD_HEADERS.MESSAGE_ID]: messageId,
          [FORGE_CAD_HEADERS.SIGNATURE]: signature,
        },
        body,
        receivedAt: new Date().toISOString(),
        correlationId: "c1",
      },
      {
        tenantId: "t1",
        connectionId: "c1",
        publicId: "pub",
        adapterKey: adapter.manifest.adapterKey,
        adapterVersion: adapter.manifest.adapterVersion,
        environment: "SIMULATOR",
        transportType: "HTTPS_WEBHOOK",
        configuration: {
          __runtimeWebhookSecrets: { k1: secret },
        },
      },
    );
    expect(result.status).toBe("VALID");
  });

  it("normalizes synthetic incident create", async () => {
    const parsed = await adapter.parseRawMessage(
      {
        id: "raw-1",
        tenantId: "t1",
        connectionId: "c1",
        receivedAt: new Date().toISOString(),
        transportType: "HTTPS_WEBHOOK",
        payloadStorageType: "S3",
        payloadHash: bodyHash,
      },
      body,
    );
    const normalized = await adapter.normalize(parsed, {
      tenantId: "t1",
      connectionId: "c1",
    });
    expect(normalized.ok).toBe(true);
    expect(normalized.event?.eventType).toBe("INCIDENT_CREATED");
    expect(normalized.event?.incident.callType).toBe("STRUCTURE_FIRE");
  });
});
