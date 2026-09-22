import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Codex SDK resolves and spawns the platform CLI binary at runtime.
  // Keep these packages as real Node modules instead of bundling them into route handlers.
  serverExternalPackages: ["@openai/codex-sdk", "@openai/codex"],
};

export default nextConfig;
