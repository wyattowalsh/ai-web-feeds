import "@/app/global.css";
import "katex/dist/katex.css";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Fraunces, Manrope } from "next/font/google";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { getRequestNonce } from "@/lib/nonce";
import {
  DEFAULT_DESCRIPTION,
  getDefaultImageUrl,
  getSiteVerification,
  publicSeoRobots,
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TWITTER_HANDLE,
  SITE_URL,
} from "@/lib/seo";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { cn } from "@/lib/utils";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "AI",
    "RSS feeds",
    "Atom feeds",
    "web feeds",
    "AI agents",
    "LLM",
    "large language models",
    "documentation",
    "PDF export",
    "machine learning",
  ],
  authors: [
    {
      name: SITE_AUTHOR,
      url: SITE_AUTHOR_URL,
    },
  ],
  creator: SITE_AUTHOR,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    images: [
      {
        url: getDefaultImageUrl(),
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
    creator: SITE_TWITTER_HANDLE,
    images: [getDefaultImageUrl()],
  },
  robots: publicSeoRobots,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: SITE_URL,
    types: {
      "application/rss+xml": [
        {
          title: `${SITE_NAME} - Sitewide`,
          url: `${SITE_URL}/rss.xml`,
        },
        {
          title: `${SITE_NAME} - Documentation`,
          url: `${SITE_URL}/docs/rss.xml`,
        },
      ],
      "application/atom+xml": [
        {
          title: `${SITE_NAME} - Sitewide (Atom)`,
          url: `${SITE_URL}/atom.xml`,
        },
        {
          title: `${SITE_NAME} - Documentation (Atom)`,
          url: `${SITE_URL}/docs/atom.xml`,
        },
      ],
      "application/feed+json": [
        {
          title: `${SITE_NAME} - Sitewide (JSON Feed)`,
          url: `${SITE_URL}/feed.json`,
        },
        {
          title: `${SITE_NAME} - Documentation (JSON Feed)`,
          url: `${SITE_URL}/docs/feed.json`,
        },
      ],
    },
  },
  verification: getSiteVerification(),
};

export default async function Layout({ children }: { children: ReactNode }) {
  const nonce = await getRequestNonce();
  return (
    <html
      lang="en"
      className={cn(bodyFont.variable, displayFont.variable, "font-sans")}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} nonce={nonce} />
        <RootProvider search={{ options: { api: "/api/docs/search" } }} theme={{ nonce }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
