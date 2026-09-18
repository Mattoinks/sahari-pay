import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tenantpay/shared"],
  devIndicators: false,
};

export default nextConfig;
