import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const tenantId = "0882c865-59c2-49a6-ab88-ce6ca89be30c";
const principal = JSON.stringify({
  userId: "0a46dd93-4ecf-4c91-9fad-70d24cee3308",
  tenantId,
});
const bodyPath = process.env.TEMP + "/branding-upload-body.json";
writeFileSync(
  bodyPath,
  JSON.stringify({
    filename: "dot.png",
    mimeType: "image/png",
    dataBase64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  }),
);

const out = spawnSync(
  "curl.exe",
  [
    "-sS",
    "-w",
    "\nHTTP_STATUS:%{http_code}\n",
    "-X",
    "POST",
    `https://api-dev.forgepublicsafety.com/api/v1/tenants/${tenantId}/branding/assets`,
    "-H",
    "Accept: application/json",
    "-H",
    "Content-Type: application/json",
    "-H",
    `Idempotency-Key: probe-${Date.now()}`,
    "-H",
    `x-forge-dev-principal: ${principal}`,
    "--data-binary",
    `@${bodyPath}`,
  ],
  { encoding: "utf8" },
);
process.stdout.write(out.stdout || "");
process.stderr.write(out.stderr || "");
process.exit(out.status ?? 1);
