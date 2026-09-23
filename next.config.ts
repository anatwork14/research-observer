import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker listens on 0.0.0.0 but users open the documented loopback URL.
  // Allow that host to load Next.js development chunks and HMR endpoints.
  allowedDevOrigins: ["127.0.0.1"],
  // Codex SDK resolves and spawns the platform CLI binary at runtime.
  // Keep these packages as real Node modules instead of bundling them into route handlers.
  serverExternalPackages: ["@openai/codex-sdk", "@openai/codex"],
};

export default nextConfig;
