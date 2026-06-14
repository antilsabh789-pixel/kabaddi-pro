import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // NOTE: Do NOT set allowedDevOrigins - when set, Next.js switches from 'warn' to 'block' mode
  // for cross-origin requests, which breaks chunk loading from 127.0.0.1.
  // Leaving it undefined means cross-origin requests get a warning but still work.
};

export default nextConfig;
