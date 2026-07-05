import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev uses `.next-dev` so `next start` (production) is not broken while dev runs.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Prevents corrupted webpack chunks after hot-reload (common on network drives).
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
