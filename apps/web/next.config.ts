import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@indoquake/shared",
    "@indoquake/bmkg",
    "@indoquake/geo",
    "@indoquake/database",
    "@indoquake/earthquake",
    "@indoquake/tsunami",
    "@indoquake/regions",
    "@indoquake/notifications",
  ],
};

export default nextConfig;
