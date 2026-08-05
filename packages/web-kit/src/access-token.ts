/**
 * Strict Cognito access-token shape checks for browser storage.
 * JWKS documents and other non-JWT payloads must never become Authorization bearers.
 */

export class InvalidAccessTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAccessTokenError";
  }
}

/** Compact JWT form: header.payload.signature (three base64url segments). */
const COMPACT_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function looksLikeJwksDocument(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(trimmed) as { keys?: unknown };
    return Array.isArray(parsed.keys);
  } catch {
    return false;
  }
}

/**
 * Asserts `token` is a compact JWT suitable as a Cognito access_token.
 * Rejects JWKS JSON, ID/refresh token blobs stored as objects, and empty values.
 */
export function assertAccessTokenShape(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new InvalidAccessTokenError("Access token is empty");
  }
  if (looksLikeJwksDocument(trimmed)) {
    throw new InvalidAccessTokenError(
      "Refusing to store a JWKS document as an access token. Use the Cognito access_token JWT only.",
    );
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    throw new InvalidAccessTokenError(
      "Refusing to store JSON as an access token. Use the Cognito access_token JWT only.",
    );
  }
  if (!COMPACT_JWT.test(trimmed)) {
    throw new InvalidAccessTokenError(
      "Access token must be a compact JWT (three base64url segments). JWKS and other payloads are not valid Authorization bearers.",
    );
  }
  return trimmed;
}
