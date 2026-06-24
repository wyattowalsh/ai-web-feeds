"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const SUGGESTED_FEEDS = [
  {
    title: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    topic: "ai",
  },
  {
    title: "Google AI Blog",
    url: "https://blog.research.google/feeds/posts/default",
    topic: "ml",
  },
  {
    title: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    topic: "ml",
  },
  {
    title: "The Batch (deeplearning.ai)",
    url: "https://www.deeplearning.ai/the-batch/feed/",
    topic: "ai",
  },
  {
    title: "MIT Technology Review — AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    topic: "ai",
  },
];

export default function OnboardingPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set(SUGGESTED_FEEDS.map((f) => f.url)));

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const importQuery = [...selected].map((url) => encodeURIComponent(url)).join(",");

  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Welcome to AI Web Feeds</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        Start with curated AI and ML sources, save articles for offline reading, and organize feeds
        locally — no account required.
      </p>

      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-(--ink)">
        <li>Pick suggested feeds below (stored only in your browser).</li>
        <li>Open the reader and import your selection.</li>
        <li>Enable offline sync from any feed card when you are ready.</li>
      </ol>

      <ul className="mt-6 divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
        {SUGGESTED_FEEDS.map((feed) => (
          <li key={feed.url} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(feed.url)}
              onChange={() => toggle(feed.url)}
              aria-label={`Subscribe to ${feed.title}`}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-(--ink)">{feed.title}</div>
              <div className="text-xs text-(--ink-muted)">{feed.url}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={selected.size ? `/feeds?import=${importQuery}` : "/feeds"}>
            Continue to feeds ({selected.size})
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/reader">Skip to reader</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/settings/data-portability">Import existing OPML</Link>
        </Button>
      </div>
    </div>
  );
}
