"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenText, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { HUB_ROUTES } from "@/lib/hub/links";

const ONBOARDING_STORAGE_KEY = "aiwebfeeds.onboarding.dismissed";

type OnboardingCoachProps = {
  className?: string;
};

export function OnboardingCoach({ className }: OnboardingCoachProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const dismissed = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    setVisible(dismissed !== "true");
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <aside
      className={cn("surface-panel relative space-y-4 border-primary/20 bg-primary/5", className)}
      aria-label="Getting started"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-3 right-3"
        onClick={dismiss}
        aria-label="Dismiss onboarding"
      >
        <X className="size-4" />
      </Button>
      <div className="space-y-2 pr-8">
        <p className="eyebrow">
          <Sparkles className="size-3.5" />
          Welcome
        </p>
        <h2 className="text-title-medium">Start reading in three steps</h2>
        <p className="section-copy">
          Browse the corpus, personalize your stream, and open articles in the immersive reader.
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        <li className="surface-card-soft space-y-2">
          <BookOpenText className="size-5 text-primary" />
          <p className="font-semibold">Open Reader</p>
          <p className="text-sm text-muted-foreground">Filter by topic, source, or unread state.</p>
          <Link
            href={HUB_ROUTES.reader}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Go to Reader
          </Link>
        </li>
        <li className="surface-card-soft space-y-2">
          <Search className="size-5 text-primary" />
          <p className="font-semibold">Search corpus</p>
          <p className="text-sm text-muted-foreground">Find articles across all indexed sources.</p>
          <Link
            href={HUB_ROUTES.search}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Search
          </Link>
        </li>
        <li className="surface-card-soft space-y-2">
          <Sparkles className="size-5 text-primary" />
          <p className="font-semibold">For You</p>
          <p className="text-sm text-muted-foreground">See recommendations and saved searches.</p>
          <Link
            href={HUB_ROUTES.forYou}
            className="text-sm font-semibold text-primary hover:underline"
          >
            For You
          </Link>
        </li>
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={dismiss}>
        Got it
      </Button>
    </aside>
  );
}
