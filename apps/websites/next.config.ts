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
};

export default nextConfig;
