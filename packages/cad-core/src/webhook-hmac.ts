import { createHmac, timingSafeEqual } from "node:crypto";

export const FORGE_CAD_HEADERS = {
  KEY_ID: "x-forge-cad-key-id",
  TIMESTAMP: "x-forge-cad-timestamp",
  NONCE: "x-forge-cad-nonce",
  SIGNATURE: "x-forge-cad-signature",
  MESSAGE_ID: "x-forge-cad-message-id",
} as const;

/**
 * Canonical signature input (deterministic):
 * `${timestamp}.${nonce}.${messageId}.${sha256HexBody}`
 * Signature = hex(HMAC-SHA256(secret, canonical))
 */
export function buildCadWebhookCanonicalString(input: {
  timestamp: string;
  nonce: string;
  messageId: string;
  bodySha256Hex: string;
}): string {
  return `${input.timestamp}.${input.nonce}.${input.messageId}.${input.bodySha256Hex}`;
}

export function signCadWebhookPayload(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  messageId: string;
  bodySha256Hex: string;
}): string {
  const canonical = buildCadWebhookCanonicalString(input);
  return createHmac("sha256", input.secret).update(canonical, "utf8").digest("hex");
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length === 0 || left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export type CadWebhookAuthFailureCode =
  | "MISSING_SIGNATURE"
  | "MISSING_TIMESTAMP"
  | "MISSING_NONCE"
  | "MISSING_MESSAGE_ID"
  | "MISSING_KEY_ID"
  | "INVALID_SIGNATURE"
  | "EXPIRED_TIMESTAMP"
  | "FUTURE_TIMESTAMP"
  | "INVALID_KEY_ID"
  | "REPLAYED_NONCE"
  | "REPLAYED_MESSAGE_ID";

export type CadWebhookAuthEvaluation =
  | { ok: true; keyId: string; timestamp: string; nonce: string; messageId: string }
  | { ok: false; code: CadWebhookAuthFailureCode; summary: string };

export function evaluateCadWebhookTimestamp(input: {
  timestampHeader: string;
  nowMs?: number;
  skewToleranceSeconds?: number;
}): { ok: true } | { ok: false; code: "EXPIRED_TIMESTAMP" | "FUTURE_TIMESTAMP"; summary: string } {
  const skew = input.skewToleranceSeconds ?? 300;
  const nowMs = input.nowMs ?? Date.now();
  const ts = Number(input.timestampHeader);
  if (!Number.isFinite(ts)) {
    return { ok: false, code: "EXPIRED_TIMESTAMP", summary: "Invalid timestamp header" };
  }
  // Accept seconds or milliseconds
  const tsMs = ts > 1_000_000_000_000 ? ts : ts * 1000;
  const deltaSec = Math.abs(nowMs - tsMs) / 1000;
  if (tsMs > nowMs + skew * 1000) {
    return { ok: false, code: "FUTURE_TIMESTAMP", summary: "Timestamp too far in the future" };
  }
  if (nowMs - tsMs > skew * 1000) {
    return { ok: false, code: "EXPIRED_TIMESTAMP", summary: "Timestamp expired" };
  }
  if (deltaSec > skew) {
    return { ok: false, code: "EXPIRED_TIMESTAMP", summary: "Timestamp outside tolerance" };
  }
  return { ok: true };
}

export function verifyCadWebhookSignature(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  messageId: string;
  bodySha256Hex: string;
  providedSignatureHex: string;
}): boolean {
  const expected = signCadWebhookPayload({
    secret: input.secret,
    timestamp: input.timestamp,
    nonce: input.nonce,
    messageId: input.messageId,
    bodySha256Hex: input.bodySha256Hex,
  });
  return constantTimeEqualHex(expected, input.providedSignatureHex.toLowerCase());
}
