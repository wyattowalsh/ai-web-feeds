/**
 * PWA Manifest Configuration
 * 
 * Defines Progressive Web App manifest for install-to-home-screen functionality.
 * 
 * @see specs/004-client-side-features/tasks.md#t048
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'AI Web Feeds',
    short_name:       'AI Feeds',
    description:      'Curated AI/ML RSS feeds with offline reading, instant search, and smart organization',
    start_url:        '/',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      '#667eea',
    orientation:      'portrait-primary',
    
    icons: [
      {
        src:     '/android-chrome-192x192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any maskable',
      },
      {
        src:     '/android-chrome-512x512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any maskable',
      },
      {
        src:   '/apple-touch-icon.png',
        sizes: '180x180',
        type:  'image/png',
      },
      {
        src:   '/favicon-32x32.png',
        sizes: '32x32',
        type:  'image/png',
      },
      {
        src:   '/favicon-16x16.png',
        sizes: '16x16',
        type:  'image/png',
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
