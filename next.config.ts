import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Keep existing config options here */
  eslint: {
    // Allow production builds to successfully complete even if there are ESLint errors.
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev }) => {
    // Disable CSS minification in production to avoid cssnano-simple crash
    if (!dev) {
      if (!config.optimization) {
        config.optimization = {};
      }
      config.optimization.minimize = false;
    }

    return config;
  },
};

export default nextConfig;
