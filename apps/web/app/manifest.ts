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
    
    categories: [
      'news',
      'productivity',
      'education',
    ],
    
    shortcuts: [
      {
        name:        'Search',
        short_name:  'Search',
        description: 'Search articles',
        url:         '/search',
        icons:       [
          {
            src:   '/icon.svg',
            sizes: '96x96',
          },
        ],
      },
      {
        name:        'Feeds',
        short_name:  'Feeds',
        description: 'Browse feeds',
        url:         '/feeds',
        icons:       [
          {
            src:   '/icon.svg',
            sizes: '96x96',
          },
        ],
      },
      {
        name:        'Offline',
        short_name:  'Offline',
        description: 'Offline articles',
        url:         '/feeds/offline',
        icons:       [
          {
            src:   '/icon.svg',
            sizes: '96x96',
          },
        ],
      },
    ],
    
    related_applications: [],
    prefer_related_applications: false,
    
    scope: '/',
    
    // PWA features
    display_override: ['window-controls-overlay', 'standalone'],
    
    // Protocol handlers (future)
    // protocol_handlers: [
    //   {
    //     protocol: 'web+feed',
    //     url: '/subscribe?url=%s',
    //   },
    // ],
  };
}
