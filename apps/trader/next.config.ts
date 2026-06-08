import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root for build-trace file collection (silences the multi-lockfile
  // warning from a stray lockfile in the home directory).
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    // Privy lazy-imports optional connectors we don't use (Farcaster mini-app,
    // Stripe onramp). Resolve them to empty so the bundler doesn't fail.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@farcaster/mini-app-solana": false,
      "@stripe/crypto": false,
    };
    return config;
  },
};

export default nextConfig;
