import {
  getRefreshToken,
  setBearerToken,
  setRefreshToken,
} from "./auth-storage.js";

const PKCE_VERIFIER_KEY = "forge-oauth-pkce-verifier";
const OAUTH_STATE_KEY = "forge-oauth-state";

export type CognitoOAuthConfig = {
  domain: string;
  clientId: string;
  userPoolId: string;
  appUrl: string;
};

export type CognitoTokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
};

export class CognitoOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CognitoOAuthError";
  }
}

function requireBrowser(): void {
  if (typeof window === "undefined") {
    throw new CognitoOAuthError("Cognito OAuth is only available in the browser");
  }
}

function readPublicEnv(): {
  domain?: string;
  clientId?: string;
  userPoolId?: string;
  appUrl?: string;
} {
  // Next.js only inlines statically referenced NEXT_PUBLIC_* keys.
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  // Prefer the live browser origin so one static build can OAuth on industrial-dev,
  // producers-rice-mill, CloudFront, and localhost without redirect_mismatch.
  const appUrl =
    (typeof window !== "undefined" ? window.location.origin : undefined) ??
    process.env.NEXT_PUBLIC_APP_URL;

  return {
    ...(domain ? { domain } : {}),
    ...(clientId ? { clientId } : {}),
    ...(userPoolId ? { userPoolId } : {}),
    ...(appUrl ? { appUrl } : {}),
  };
}

export function getCognitoOAuthConfig(): CognitoOAuthConfig {
  const { domain, clientId, userPoolId, appUrl } = readPublicEnv();

  if (!domain || !clientId || !userPoolId || !appUrl) {
    throw new CognitoOAuthError(
      "Missing Cognito OAuth configuration (NEXT_PUBLIC_COGNITO_DOMAIN, NEXT_PUBLIC_COGNITO_CLIENT_ID, NEXT_PUBLIC_COGNITO_USER_POOL_ID, NEXT_PUBLIC_APP_URL)",
    );
  }

  return { domain, clientId, userPoolId, appUrl };
}

function callbackRedirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/auth/callback/`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  requireBrowser();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  requireBrowser();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function tokenEndpoint(domain: string): string {
  return `https://${domain}/oauth2/token`;
}

function authorizeEndpoint(domain: string): string {
  return `https://${domain}/oauth2/authorize`;
}

function logoutEndpoint(domain: string): string {
  return `https://${domain}/logout`;
}

export async function buildAuthorizeUrl(): Promise<string> {
  requireBrowser();
  const config = getCognitoOAuthConfig();
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: callbackRedirectUri(config.appUrl),
    scope: "openid email profile",
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });

  return `${authorizeEndpoint(config.domain)}?${params.toString()}`;
}

export function validateOAuthState(state: string | null): boolean {
  requireBrowser();
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  return Boolean(state && expected && state === expected);
}

export async function exchangeCodeForTokens(code: string): Promise<CognitoTokenResponse> {
  requireBrowser();
  const config = getCognitoOAuthConfig();
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    throw new CognitoOAuthError("Missing PKCE code verifier — restart sign-in");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: callbackRedirectUri(config.appUrl),
    code_verifier: verifier,
  });

  const res = await fetch(tokenEndpoint(config.domain), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  let payload: CognitoTokenResponse & { error?: string; error_description?: string };
  try {
    payload = (await res.json()) as CognitoTokenResponse & {
      error?: string;
      error_description?: string;
    };
  } catch {
    throw new CognitoOAuthError(`Token exchange failed (${res.status})`);
  }

  if (!res.ok || !payload.access_token) {
    const detail = payload.error_description ?? payload.error ?? `HTTP ${res.status}`;
    throw new CognitoOAuthError(`Token exchange failed: ${detail}`);
  }

  setBearerToken(payload.access_token);
  if (payload.refresh_token) {
    setRefreshToken(payload.refresh_token);
  }

  return payload;
}

export async function refreshAccessToken(
  options?: { signal?: AbortSignal },
): Promise<CognitoTokenResponse | null> {
  requireBrowser();
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const config = getCognitoOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenEndpoint(config.domain), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  let payload: CognitoTokenResponse & { error?: string; error_description?: string };
  try {
    payload = (await res.json()) as CognitoTokenResponse & {
      error?: string;
      error_description?: string;
    };
  } catch {
    throw new CognitoOAuthError(`Token refresh failed (${res.status})`);
  }

  if (!res.ok || !payload.access_token) {
    const detail = payload.error_description ?? payload.error ?? `HTTP ${res.status}`;
    throw new CognitoOAuthError(`Token refresh failed: ${detail}`);
  }

  setBearerToken(payload.access_token);
  if (payload.refresh_token) {
    setRefreshToken(payload.refresh_token);
  }

  return payload;
}

export function buildLogoutUrl(): string {
  const config = getCognitoOAuthConfig();
  const logoutUri = `${config.appUrl.replace(/\/$/, "")}/`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: logoutUri,
  });
  return `${logoutEndpoint(config.domain)}?${params.toString()}`;
}

export async function redirectToCognitoLogin(): Promise<void> {
  requireBrowser();
  window.location.assign(await buildAuthorizeUrl());
}
