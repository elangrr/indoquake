import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  // Standalone server for deploy/Dockerfile.web; tracing starts at the monorepo root.
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  poweredByHeader: false,
  // NEXT_BUILD_CPUS caps build workers (each starts its own thread pool); unset = Next's default.
  ...(process.env.NEXT_BUILD_CPUS ? { experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) } } : {}),
  transpilePackages: [
    "@indoquake/api",
    "@indoquake/shared",
    "@indoquake/bmkg",
    "@indoquake/geo",
    "@indoquake/database",
    "@indoquake/earthquake",
    "@indoquake/tsunami",
    "@indoquake/regions",
    "@indoquake/notifications",
  ],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
