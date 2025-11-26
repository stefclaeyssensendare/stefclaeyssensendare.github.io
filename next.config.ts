import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/nn-next", // root path for GitHub Pages
  assetPrefix: "./", // makes CSS/JS relative
};

export default nextConfig;
