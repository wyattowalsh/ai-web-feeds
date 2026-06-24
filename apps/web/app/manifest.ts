import type { MetadataRoute } from "next";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - RSS and Atom feeds for AI writing`,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: "/reader",
    display: "standalone",
    background_color: "#f8f5ed",
    theme_color: "#f8f5ed",
    categories: ["news", "productivity"],
    orientation: "any",
    shortcuts: [
      { name: "Reader", short_name: "Reader", url: "/reader", description: "Open the feed reader" },
      {
        name: "Search",
        short_name: "Search",
        url: "/search",
        description: "Search cached articles",
      },
      {
        name: "Offline",
        short_name: "Offline",
        url: "/offline",
        description: "Manage offline feeds",
      },
    ],
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
