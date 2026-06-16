import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove "standalone" output for Vercel deployment
  // Vercel handles the build output natively
  // output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
