import Link from "next/link";
import { ArrowRight, Newspaper, Search } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function ArticleNotFound() {
  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="space-y-5">
          <span className="eyebrow">
            <Newspaper className="size-3.5" />
            Article reference
          </span>
          <div className="space-y-4">
            <h1 className="text-title-large max-w-4xl">Article reference not found</h1>
            <p className="hero-copy max-w-3xl">
              This article is not available in the generated public corpus. Open the reader for
              current posts, or browse the source catalog while the corpus is regenerated.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/reader" className={cn(buttonVariants({ variant: "default" }))}>
              Open reader
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/sources" className={cn(buttonVariants({ variant: "outline" }))}>
              Browse sources
              <Search className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
