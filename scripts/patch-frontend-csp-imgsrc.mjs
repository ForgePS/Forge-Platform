#!/usr/bin/env node
/**
 * Patch static-hosting CloudFront response header policies: allow https: images.
 * Usage: node scripts/patch-frontend-csp-imgsrc.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const POLICY_IDS = {
  console: "e059d156-a28b-4f6d-bc8f-9b96a8660fbc",
  industrial: "31dfc752-0145-4d64-81c7-29903892b76b",
  tenantadmin: "9bf5fb0d-df99-4e7e-9c03-bc9409b13208",
  rms: "670a6b24-5fce-4a02-b731-56baf561a2e3",
};

function awsJson(args) {
  const out = execFileSync("aws", args, { encoding: "utf8" });
  return JSON.parse(out);
}

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
  "form-action 'self' https:",
].join("; ");

for (const [app, id] of Object.entries(POLICY_IDS)) {
  const got = awsJson([
    "cloudfront",
    "get-response-headers-policy",
    "--id",
    id,
    "--output",
    "json",
  ]);
  const etag = got.ETag;
  const cfg = got.ResponseHeadersPolicy.ResponseHeadersPolicyConfig;
  cfg.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy = csp;
  // API expects the policy config object at top level with Name/Comment etc.
  const payloadPath = `.forge-rhp-${app}.json`;
  fs.writeFileSync(payloadPath, JSON.stringify(cfg, null, 2));
  execFileSync(
    "aws",
    [
      "cloudfront",
      "update-response-headers-policy",
      "--id",
      id,
      "--if-match",
      etag,
      "--response-headers-policy-config",
      `file://${payloadPath.replace(/\\/g, "/")}`,
      "--output",
      "json",
      "--query",
      "ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy",
    ],
    { stdio: "inherit" },
  );
  console.log(`patched ${app} (${id})`);
}

console.log("done");
