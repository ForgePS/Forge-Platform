// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { assertAccessTokenShape, InvalidAccessTokenError } from "./access-token.js";
import {
  clearAuthStorage,
  getBearerToken,
  setBearerToken,
} from "./auth-storage.js";
import {
  configureApiClient,
  getApiBaseUrl,
} from "./api-client.js";

const SAMPLE_JWT =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidG9rZW5fdXNlIjoiYWNjZXNzIn0.signature";

const JWKS_JSON = JSON.stringify({
  keys: [
    {
      alg: "RS256",
      e: "AQAB",
      kid: "test",
      kty: "RSA",
      n: "sXCNC...",
      use: "sig",
    },
  ],
});

describe("access token shape", () => {
  it("accepts compact JWTs", () => {
    expect(assertAccessTokenShape(SAMPLE_JWT)).toBe(SAMPLE_JWT);
  });

  it("rejects JWKS documents", () => {
    expect(() => assertAccessTokenShape(JWKS_JSON)).toThrow(InvalidAccessTokenError);
    expect(() => assertAccessTokenShape(JWKS_JSON)).toThrow(/JWKS/);
  });

  it("rejects arbitrary JSON", () => {
    expect(() => assertAccessTokenShape('{"access_token":"nope"}')).toThrow(InvalidAccessTokenError);
  });
});

describe("setBearerToken", () => {
  beforeEach(() => {
    clearAuthStorage();
  });

  it("stores a Cognito access_token JWT", () => {
    setBearerToken(SAMPLE_JWT);
    expect(getBearerToken()).toBe(SAMPLE_JWT);
  });

  it("never stores JWKS as the Authorization bearer source", () => {
    expect(() => setBearerToken(JWKS_JSON)).toThrow(InvalidAccessTokenError);
    expect(getBearerToken()).toBeNull();
  });
});

describe("api client base URL", () => {
  it("uses configured API base URL (canonical development domain)", () => {
    configureApiClient({ baseUrl: "https://api-dev.forgepublicsafety.com" });
    expect(getApiBaseUrl()).toBe("https://api-dev.forgepublicsafety.com");
  });
});
