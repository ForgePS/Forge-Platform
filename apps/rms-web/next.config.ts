import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: [
    "@forge/ui",
    "@forge/design-system",
    "@forge/web-kit",
    "@forge/fx-design-tokens",
    "@forge/fx-ui",
    "@forge/fx-layouts",
    "@forge/fx-hooks",
    "@forge/fx-icons",
    "@forge/fx-patterns",
    "@forge/fx-utils",
  ],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
