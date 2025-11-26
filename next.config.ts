import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // <-- enables static HTML export
  trailingSlash: true, // optional, ensures URLs like /about/ instead of /about.html
};

export default nextConfig;
