import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Site photos arrive as data URLs from the browser camera.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
