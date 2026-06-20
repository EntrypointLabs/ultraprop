import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root for build-trace file collection (silences the multi-lockfile
  // warning from a stray lockfile in the home directory).
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Workspace packages consumed by the app; transpile them so Next bundles them
  // cleanly across the monorepo. sim-core is the shared paper-engine math.
  transpilePackages: [
    "@shared/venues",
    "@shared/sim-core",
    "@shared/sui-propfirm",
    "@shared/db",
  ],
  // Same-origin proxy to the venue gateway. The browser only ever calls
  // same-origin `/api/*`; the venue layer (keys, rate-limits, CORS) stays
  // server-side. `/api/feed` is SSE — Next's rewrite proxy streams the response
  // through unbuffered, so live ticks arrive in real time.
  async rewrites() {
    // A prod deploy without GATEWAY_URL silently falls back to localhost, where
    // nothing is listening — catalog/feed/candles all dead-end. Make that loud.
    if (!process.env.GATEWAY_URL && process.env.NODE_ENV === "production") {
      console.warn(
        "[next.config] GATEWAY_URL is unset in production; falling back to http://localhost:8787. The venue gateway is almost certainly unreachable — catalog, feed, and candles will fail. Set GATEWAY_URL to the deployed gateway origin.",
      );
    }
    const gateway = process.env.GATEWAY_URL ?? "http://localhost:8787";
    return [
      { source: "/api/catalog", destination: `${gateway}/api/catalog` },
      { source: "/api/feed", destination: `${gateway}/api/feed` },
      { source: "/api/candles", destination: `${gateway}/api/candles` },
    ];
  },
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
