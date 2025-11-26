import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true, // optional, helps routing
  assetPrefix: "./", // <-- important for GitHub Pages
};

export default nextConfig;
