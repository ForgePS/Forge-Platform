// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { generateCodeChallenge, generateCodeVerifier } from "./cognito-oauth.js";

describe("cognito oauth pkce", () => {
  it("generates URL-safe verifier and matching S256 challenge", async () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);

    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toBe(verifier);
  });
});
