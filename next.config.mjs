import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendUrl = process.env.BACKEND_URL?.trim().replace(/\/$/, "");

if (process.env.VERCEL && !backendUrl) {
  throw new Error("Set BACKEND_URL to the deployed Python API URL in Vercel project settings.");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
    proxyTimeout: 600_000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl || "http://127.0.0.1:8000"}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://cdn.jsdelivr.net; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://cdn.jsdelivr.net; frame-ancestors 'none'; object-src 'none'; base-uri 'self';",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
  webpack(config, { dev }) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /@vladmandic[\\/]face-api/ },
    ];
    if (dev) {
      config.cache = { type: "memory" };
      config.watchOptions = {
        ...config.watchOptions,
        ignored: /node_modules|\.git|\.next/,
      };
    }
    return config;
  },
};

export default nextConfig;
