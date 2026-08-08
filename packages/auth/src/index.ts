import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface CognitoTokenClaims extends JWTPayload {
  sub: string;
  token_use?: string;
  client_id?: string;
  aud?: string | string[];
  email?: string;
}

export interface CognitoVerifierOptions {
  region: string;
  userPoolId: string;
  clientId: string;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(region: string, userPoolId: string) {
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    jwksCache.set(issuer, jwks);
  }
  return { issuer, jwks };
}

function rejectNonJwtBearer(token: string) {
  const trimmed = token.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    throw new Error("Bearer token must be a compact JWT, not JWKS or JSON");
  }
}

export async function verifyCognitoAccessToken(
  token: string,
  options: CognitoVerifierOptions,
): Promise<CognitoTokenClaims> {
  rejectNonJwtBearer(token);
  const { issuer, jwks } = getJwks(options.region, options.userPoolId);
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    clockTolerance: 5,
  });

  const claims = payload as CognitoTokenClaims;
  if (!claims.sub) {
    throw new Error("Token missing subject");
  }
  // Cognito access tokens carry token_use=access; id tokens are not accepted for API auth.
  if (claims.token_use !== "access") {
    throw new Error("Unexpected token_use");
  }

  const audience = claims.client_id ?? claims.aud;
  const audiences = Array.isArray(audience) ? audience : audience ? [audience] : [];
  const allowedClients = options.clientId
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!allowedClients.some((id) => audiences.includes(id))) {
    throw new Error("Token audience/client mismatch");
  }

  return claims;
}

export function clearJwksCache(): void {
  jwksCache.clear();
}
