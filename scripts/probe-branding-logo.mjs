#!/usr/bin/env node
/**
 * Probe branding logo URLs for a tenant using platform-admin style principal.
 * Usage: node scripts/probe-branding-logo.mjs [tenantId] [userId]
 */
import { spawnSync } from "node:child_process";

const tenantId = process.argv[2] ?? "0882c865-59c2-49a6-ab88-ce6ca89be30c";
// PSA who published earlier in thread
const userId = process.argv[3] ?? "ba491113-ba27-4ee6-8989-2eec1fe285d2";

function curl(args) {
  return spawnSync("curl.exe", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

function withPrincipal(url, extra = []) {
  // For PSA, tenantHint must be home tenant — try route tenant first, then we'll retry
  const principal = JSON.stringify({ userId, tenantId });
  return curl([
    "-sS",
    "-w",
    "\nHTTP:%{http_code}",
    url,
    "-H",
    "Accept: application/json",
    "-H",
    `x-forge-dev-principal: ${principal}`,
    ...extra,
  ]).stdout;
}

const effective = withPrincipal(
  `https://api-dev.forgepublicsafety.com/api/v1/tenants/${tenantId}/config/branding/default/effective`,
);
console.log("=== EFFECTIVE ===");
console.log(effective.slice(0, 2500));

const versions = withPrincipal(
  `https://api-dev.forgepublicsafety.com/api/v1/tenants/${tenantId}/config/branding/default/versions`,
);
console.log("\n=== VERSIONS (first 3k) ===");
console.log(versions.slice(0, 3000));

try {
  const body = versions.replace(/\nHTTP:\d+$/, "");
  const parsed = JSON.parse(body);
  const list = parsed?.data?.versions ?? [];
  for (const v of list.slice(0, 6)) {
    const p = v.payloadJson ?? {};
    console.log(`\nv${v.version} ${v.state} logo=${p.logoUrl ?? "-"} icon=${p.iconUrl ?? "-"}`);
    for (const field of ["logoUrl", "iconUrl"]) {
      if (!p[field]) continue;
      const head = curl(["-sS", "-D", "-", "-o", "NUL", p[field]]).stdout;
      console.log(`\n--- ${field} headers ---`);
      console.log(head.split("\r\n").slice(0, 15).join("\n"));
      const m = String(p[field]).match(/branding-assets\/([^/]+)\/([^/?#]+)/);
      if (m) {
        console.log(`assetId=${m[2]}`);
      }
    }
  }
} catch (e) {
  console.error("parse failed", e);
}
