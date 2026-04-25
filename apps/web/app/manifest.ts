import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Web Feeds - RSS/Atom Feeds for AI Agents",
    short_name: "AI Web Feeds",
    description: "Curated RSS/Atom feeds optimized for AI agents and large language models",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#667eea",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
