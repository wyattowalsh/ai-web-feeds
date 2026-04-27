import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/:path*',
      },
      {
        source: '/docs/:path*.md',
        destination: '/llms.md/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Full Content-Security-Policy (including per-request nonces for dynamic inline
          // JsonLd scripts) is set in middleware.ts. The nonce-based policy is the canonical
          // approach for Next.js App Router when allowing specific inline scripts without
          // 'unsafe-inline' on script-src. See middleware.ts for the current tight policy.
        ],
      },
    ];
  },
};

export default withMDX(config);
