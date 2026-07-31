import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  constantTimeEqualHex,
  evaluateCadWebhookTimestamp,
  signCadWebhookPayload,
  verifyCadWebhookSignature,
} from "./webhook-hmac.js";

describe("CAD webhook HMAC", () => {
  const secret = "test-secret-value";
  const body = Buffer.from(JSON.stringify({ event: "INCIDENT_CREATED", id: "1" }), "utf8");
  const bodyHash = createHash("sha256").update(body).digest("hex");

  it("signs and verifies with constant-time compare", () => {
    const signature = signCadWebhookPayload({
      secret,
      timestamp: "1700000000",
      nonce: "n1",
      messageId: "m1",
      bodySha256Hex: bodyHash,
    });
    expect(
      verifyCadWebhookSignature({
        secret,
        timestamp: "1700000000",
        nonce: "n1",
        messageId: "m1",
        bodySha256Hex: bodyHash,
        providedSignatureHex: signature,
      }),
    ).toBe(true);
    expect(
      verifyCadWebhookSignature({
        secret,
        timestamp: "1700000000",
        nonce: "n1",
        messageId: "m1",
        bodySha256Hex: bodyHash,
        providedSignatureHex: "00".repeat(32),
      }),
    ).toBe(false);
  });

  it("rejects unequal-length hex without throwing", () => {
    expect(constantTimeEqualHex("ab", "abcd")).toBe(false);
  });

  it("rejects expired timestamps", () => {
    const nowMs = 1_700_000_000_000;
    const result = evaluateCadWebhookTimestamp({
      timestampHeader: String(Math.floor((nowMs - 600_000) / 1000)),
      nowMs,
      skewToleranceSeconds: 300,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EXPIRED_TIMESTAMP");
    }
  });

  it("rejects future timestamps beyond skew", () => {
    const nowMs = 1_700_000_000_000;
    const result = evaluateCadWebhookTimestamp({
      timestampHeader: String(Math.floor((nowMs + 600_000) / 1000)),
      nowMs,
      skewToleranceSeconds: 300,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FUTURE_TIMESTAMP");
    }
  });
});
