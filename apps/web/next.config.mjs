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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
};

export default withMDX(config);
