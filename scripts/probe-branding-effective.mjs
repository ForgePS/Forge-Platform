import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const tenantId = "0882c865-59c2-49a6-ab88-ce6ca89be30c";
const principal = JSON.stringify({
  userId: "0a46dd93-4ecf-4c91-9fad-70d24cee3308",
  tenantId,
});

const out = spawnSync(
  "curl.exe",
  [
    "-sS",
    "-w",
    "\nHTTP:%{http_code}\n",
    `https://api-dev.forgepublicsafety.com/api/v1/tenants/${tenantId}/config/branding/default/effective`,
    "-H",
    "Accept: application/json",
    "-H",
    `x-forge-dev-principal: ${principal}`,
  ],
  { encoding: "utf8" },
);
process.stdout.write(out.stdout || "");
process.stderr.write(out.stderr || "");

const match = (out.stdout || "").match(/https:\/\/[^"\\]+branding-assets\/[^"\\]+/);
if (match) {
  const logo = match[0];
  console.log("\nLOGO_URL", logo);
  const img = spawnSync(
    "curl.exe",
    ["-sS", "-D", "-", "-o", process.env.TEMP + "/logo-probe.bin", "-w", "\nHTTP:%{http_code}\n", logo],
    { encoding: "utf8" },
  );
  process.stdout.write(img.stdout || "");
  process.stderr.write(img.stderr || "");
}
