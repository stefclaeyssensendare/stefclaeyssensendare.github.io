import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/nn-next",
  assetPrefix: "/nn-next/",
};

export default nextConfig;
