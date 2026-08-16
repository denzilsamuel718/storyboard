import type { NextConfig } from "next";
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" }
];
const config: NextConfig = {
  transpilePackages: ["@storyboard/shared"],
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  async headers(){return[{source:"/:path*",headers:securityHeaders}]}
};
export default config;
