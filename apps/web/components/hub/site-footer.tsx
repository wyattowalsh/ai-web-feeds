import Link from "next/link";
import { EXTERNAL_HUB_LINKS } from "@/lib/hub/links";

const year = new Date().getFullYear();

export function SiteFooter() {
  const github = EXTERNAL_HUB_LINKS.find((l) => l.id === "github");
  return (
    <footer className="mt-16 border-t bg-background text-foreground">
      <div className="page-wrap py-8 text-sm text-(--ink-muted)">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} AI Web Feeds. All rights reserved.</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/docs" className="hover:text-foreground hover:underline">
              Docs
            </Link>
            <Link href="/blog" className="hover:text-foreground hover:underline">
              Blog
            </Link>
            {github ? (
              <a
                href={github.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground hover:underline"
              >
                GitHub
              </a>
            ) : null}
          </nav>
        </div>
      </div>
    </footer>
  );
}
