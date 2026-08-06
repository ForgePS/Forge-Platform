export class InvalidAccessTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAccessTokenError";
  }
}

/**
 * Rejects empty tokens and JWKS JSON accidentally pasted into a bearer field.
 */
export function assertAccessTokenShape(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new InvalidAccessTokenError("Access token is empty");
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { keys?: unknown };
      if (parsed && Array.isArray(parsed.keys)) {
        throw new InvalidAccessTokenError("Paste a JWT access token, not a JWKS document");
      }
    } catch (err) {
      if (err instanceof InvalidAccessTokenError) throw err;
      throw new InvalidAccessTokenError("Access token must be a JWT, not JSON");
    }
  }

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new InvalidAccessTokenError("Access token must be a JWT (three segments)");
  }
}
