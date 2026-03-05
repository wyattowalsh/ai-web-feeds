import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img
            src="/icon.svg"
            alt="AI Web Feeds"
            width={75}
            height={75}
            style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}
          />
          AIWebFeeds
        </>
      ),
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [
      {
        text: 'Documentation',
        url: '/docs',
      },
      {
        text: 'Explorer',
        url: '/explorer',
      },
      {
        text: 'GitHub',
        url: 'https://github.com/wyattowalsh/ai-web-feeds',
        external: true,
      },
    ],
  };
}
