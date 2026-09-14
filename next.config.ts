import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "www.surviver.lol" }],
      destination: "https://surviver.lol/:path*",
      permanent: true,
    }];
  },
};

export default nextConfig;
