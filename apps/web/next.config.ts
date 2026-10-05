import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import path from "node:path";

// One .env for the whole repo: the evals and this app read the same keys from the repo root.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // fine if the keys are already in the environment
}

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // The firstread package ships TypeScript source.
  transpilePackages: ["firstread"],
};

export default createMDX({})(nextConfig);
