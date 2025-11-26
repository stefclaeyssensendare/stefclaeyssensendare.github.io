import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix: "./", // makes CSS/JS relative
  basePath: "", // root path for GitHub Pages
};

export default nextConfig;
