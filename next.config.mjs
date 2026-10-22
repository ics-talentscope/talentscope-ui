import { fileURLToPath } from "url";
import path from "path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Next loads env files from `ui` before importing this config; reload the workspace root.
loadEnvConfig(path.join(__dirname, ".."), undefined, console, true);

const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const onVercel = process.env.VERCEL === "1";
const backendIsLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(backendUrl);
const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const connectSrc = ["'self'", "https://cdn.jsdelivr.net", supabaseOrigin].filter(Boolean).join(" ");
const mediaSrc = ["'self'", "blob:", supabaseOrigin].filter(Boolean).join(" ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker uses a standalone server. Vercel builds its own serverless output.
  ...(onVercel ? {} : { output: "standalone" }),
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
    proxyTimeout: 600_000,
  },
  async rewrites() {
    // On Vercel, 127.0.0.1 is the function itself. Set BACKEND_URL to a public API.
    if (onVercel && backendIsLocal) return [];
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://cdn.jsdelivr.net ${supabaseOrigin}; media-src ${mediaSrc}; worker-src 'self' blob:; connect-src ${connectSrc}; frame-ancestors 'none'; object-src 'none'; base-uri 'self';`,
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
