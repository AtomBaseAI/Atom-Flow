import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  // Keep the dev-tools indicator out of the bottom-left corner where the
  // board's lock button lives.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
