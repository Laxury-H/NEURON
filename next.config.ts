import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // We want to pass eslint checks during build
    ignoreDuringBuilds: false,
  },
  typescript: {
    // We want to catch typescript errors
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
