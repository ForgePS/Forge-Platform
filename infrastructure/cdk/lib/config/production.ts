import type { ForgeEnvironmentConfig } from "./environment-schema.js";
import { validateEnvironmentConfig } from "./environment-schema.js";
import { productionCostProfile } from "./cost-profile.js";

const { knobs } = productionCostProfile;

/** Production commercial baseline — Production cost profile (sized by workload). */
export const productionConfig: ForgeEnvironmentConfig = validateEnvironmentConfig({
  environmentName: "production",
  costProfile: "production",
  partition: "aws",
  account: process.env.FORGE_PRODUCTION_ACCOUNT || "000000000000",
  region: "us-east-1",
  secondaryRegion: "us-west-2",
  projectName: "forge-platform",
  networking: {
    vpcCidr: "10.50.0.0/16",
    ...knobs.networking,
  },
  database: {
    engineVersion: "15.10",
    ...knobs.database,
  },
  retention: knobs.retention,
  compute: knobs.compute,
  features: knobs.features,
  cognito: {
    callbackUrls: ["https://academy.example.com/api/auth/callback"],
    logoutUrls: ["https://academy.example.com"],
    selfSignUpEnabled: false,
  },
});
