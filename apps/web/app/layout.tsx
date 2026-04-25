import "@/app/global.css";
import "katex/dist/katex.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Fraunces, Manrope } from "next/font/google";
import type { Metadata } from "next";

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

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ai-web-feeds.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "AI Web Feeds - Browse AI articles across the open web",
    template: "%s | AI Web Feeds",
  },
  description:
    "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one reader-first stream.",
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
      name: "Wyatt Walsh",
      url: "https://github.com/wyattowalsh",
    },
  ],
  creator: "Wyatt Walsh",
  publisher: "AI Web Feeds",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    title: "AI Web Feeds - Browse AI articles across the open web",
    description:
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one reader-first stream.",
    siteName: "AI Web Feeds",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "AI Web Feeds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Web Feeds - Browse AI articles across the open web",
    description:
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one reader-first stream.",
    creator: "@wyattowalsh",
    images: [`${baseUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: baseUrl,
    types: {
      "application/rss+xml": [
        {
          title: "AI Web Feeds - Sitewide",
          url: `${baseUrl}/rss.xml`,
        },
        {
          title: "AI Web Feeds - Documentation",
          url: `${baseUrl}/docs/rss.xml`,
        },
      ],
      "application/atom+xml": [
        {
          title: "AI Web Feeds - Sitewide (Atom)",
          url: `${baseUrl}/atom.xml`,
        },
        {
          title: "AI Web Feeds - Documentation (Atom)",
          url: `${baseUrl}/docs/atom.xml`,
        },
      ],
      "application/json": [
        {
          title: "AI Web Feeds - Sitewide (JSON Feed)",
          url: `${baseUrl}/feed.json`,
        },
        {
          title: "AI Web Feeds - Documentation (JSON Feed)",
          url: `${baseUrl}/docs/feed.json`,
        },
      ],
    },
  },
  verification: {
    google: "google-site-verification-code", // Add your verification code
    // yandex: 'yandex-verification-code',
    // yahoo: 'yahoo-verification-code',
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
import type { ReactNode } from "react";
