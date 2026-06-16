"use client";

import { type ChangeEvent, type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { Check, Clipboard, Github, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds-filters";

type FeedContributionDraft = {
  id: string;
  url: string;
  title: string;
  topics: string[];
  notes: string;
  createdAt: string;
};

type FeedContributionFormState = {
  url: string;
  title: string;
  topics: string;
  notes: string;
};

type FeedContributionPanelProps = {
  feeds: FeedSource[];
  topics: string[];
};

const CONTRIBUTION_STORAGE_KEY = "aiwebfeeds.sourceContributions.v1";
const EMPTY_FORM: FeedContributionFormState = {
  url: "",
  title: "",
  topics: "",
  notes: "",
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredDrafts(): FeedContributionDraft[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(CONTRIBUTION_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as Array<Partial<FeedContributionDraft>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isFeedContributionDraft);
  } catch {
    return [];
  }
}

function writeStoredDrafts(drafts: FeedContributionDraft[]): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(CONTRIBUTION_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore quota and privacy-mode failures; the visible draft queue still works in memory.
  }
}

function isFeedContributionDraft(
  value: Partial<FeedContributionDraft>,
): value is FeedContributionDraft {
  return (
    typeof value.id === "string" &&
    typeof value.url === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.topics) &&
    value.topics.every((topic) => typeof topic === "string") &&
    typeof value.notes === "string" &&
    typeof value.createdAt === "string"
  );
}

function createDraftId(): string {
  return `feed-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function comparableUrl(value: string | null | undefined): string | null {
  const parsed = parseHttpUrl(value ?? "");
  return parsed ? parsed.replace(/\/$/, "").toLowerCase() : null;
}

function normalizeTopic(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTopics(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(/[\n,]/)
    .map(normalizeTopic)
    .filter((topic) => {
      if (!topic || seen.has(topic)) {
        return false;
      }
      seen.add(topic);
      return true;
    });
}

function findDuplicateFeed(feeds: FeedSource[], url: string): FeedSource | null {
  const candidate = comparableUrl(url);
  if (!candidate) {
    return null;
  }

  return (
    feeds.find((feed) =>
      [feed.url, feed.feed, feed.website_url].some(
        (feedUrl) => comparableUrl(feedUrl) === candidate,
      ),
    ) ?? null
  );
}

function findDuplicateDraft(
  drafts: FeedContributionDraft[],
  url: string,
): FeedContributionDraft | null {
  const candidate = comparableUrl(url);
  if (!candidate) {
    return null;
  }

  return drafts.find((draft) => comparableUrl(draft.url) === candidate) ?? null;
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function draftToYaml(draft: FeedContributionDraft): string {
  const lines = [`- url: ${quoteYaml(draft.url)}`, "  topics:"];

  for (const topic of draft.topics) {
    lines.push(`  - ${quoteYaml(topic)}`);
  }

  if (draft.title) {
    lines.push(`  title: ${quoteYaml(draft.title)}`);
  }
  if (draft.notes) {
    lines.push(`  notes: ${quoteYaml(draft.notes)}`);
  }

  return lines.join("\n");
}

function draftsToYaml(drafts: FeedContributionDraft[]): string {
  return drafts.map(draftToYaml).join("\n");
}

function buildGitHubIssueHref(drafts: FeedContributionDraft[]): string {
  const params = new URLSearchParams();
  const firstDraft = drafts[0];
  const title =
    drafts.length === 1 && firstDraft
      ? `Add feed: ${firstDraft.title || firstDraft.url}`
      : `Add ${drafts.length} feed sources`;
  const body = [
    "### Proposed feed source",
    "",
    "```yaml",
    draftsToYaml(drafts),
    "```",
    "",
    "### Notes",
    "",
    "Submitted from the web source catalog contribution composer.",
  ].join("\n");

  params.set("title", title);
  params.set("body", body);

  return `https://github.com/wyattowalsh/ai-web-feeds/issues/new?${params.toString()}`;
}

export function FeedContributionPanel({ feeds, topics }: FeedContributionPanelProps) {
  const formId = useId();
  const [form, setForm] = useState<FeedContributionFormState>(EMPTY_FORM);
  const [drafts, setDrafts] = useState<FeedContributionDraft[]>([]);
  const [hasLoadedDrafts, setHasLoadedDrafts] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(readStoredDrafts());
    setHasLoadedDrafts(true);
  }, []);

  useEffect(() => {
    if (hasLoadedDrafts) {
      writeStoredDrafts(drafts);
    }
  }, [drafts, hasLoadedDrafts]);

  const normalizedTopics = useMemo(
    () => Array.from(new Set(topics.filter(Boolean))).sort(),
    [topics],
  );
  const contributionYaml = useMemo(() => draftsToYaml(drafts), [drafts]);
  const githubIssueHref = useMemo(() => buildGitHubIssueHref(drafts), [drafts]);

  const updateField =
    (field: keyof FeedContributionFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setFormError(null);
      setStatus(null);
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const url = parseHttpUrl(form.url);
    if (!url) {
      setFormError("Enter a valid HTTP or HTTPS feed URL.");
      return;
    }

    const draftTopics = parseTopics(form.topics);
    if (draftTopics.length === 0) {
      setFormError("Add at least one topic.");
      return;
    }

    if (draftTopics.length > 6) {
      setFormError("Use six or fewer topics.");
      return;
    }

    const duplicateFeed = findDuplicateFeed(feeds, url);
    if (duplicateFeed) {
      setFormError(`Already in catalog: ${duplicateFeed.title || duplicateFeed.url}`);
      return;
    }

    const duplicateDraft = findDuplicateDraft(drafts, url);
    if (duplicateDraft) {
      setFormError(`Already queued: ${duplicateDraft.title || duplicateDraft.url}`);
      return;
    }

    const draft: FeedContributionDraft = {
      id: createDraftId(),
      url,
      title: form.title.trim(),
      topics: draftTopics,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setDrafts((current) => [draft, ...current]);
    setForm(EMPTY_FORM);
    setFormError(null);
    setStatus(`Queued ${draft.title || draft.url}.`);
  };

  const copyYaml = async (yaml: string, nextStatus: string) => {
    if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
      setStatus("Clipboard unavailable. Select the YAML preview and copy it manually.");
      return;
    }

    try {
      await navigator.clipboard.writeText(yaml);
      setStatus(nextStatus);
    } catch {
      setStatus("Clipboard unavailable. Select the YAML preview and copy it manually.");
    }
  };

  const removeDraft = (draftId: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
    setStatus("Removed queued feed.");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="metric-label">Contribute</p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">Add a source</h2>
        </div>
        <Badge variant="secondary" className="h-7 rounded-md">
          {drafts.length === 1 ? "1 queued" : `${drafts.length} queued`}
        </Badge>
      </div>

      <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <div>
          <label htmlFor={`${formId}-url`} className="field-label">
            Feed URL
          </label>
          <Input
            id={`${formId}-url`}
            type="url"
            required
            value={form.url}
            onChange={updateField("url")}
            placeholder="https://example.com/feed.xml"
            aria-invalid={Boolean(formError)}
          />
        </div>

        <div>
          <label htmlFor={`${formId}-title`} className="field-label">
            Title
          </label>
          <Input
            id={`${formId}-title`}
            value={form.title}
            onChange={updateField("title")}
            placeholder="Example Research Blog"
            maxLength={160}
          />
        </div>

        <div>
          <label htmlFor={`${formId}-topics`} className="field-label">
            Topics
          </label>
          <Input
            id={`${formId}-topics`}
            required
            value={form.topics}
            onChange={updateField("topics")}
            list={`${formId}-topics-list`}
            placeholder="agents, llm, research"
          />
          <datalist id={`${formId}-topics-list`}>
            {normalizedTopics.map((topic) => (
              <option key={topic} value={topic} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor={`${formId}-notes`} className="field-label">
            Notes
          </label>
          <textarea
            id={`${formId}-notes`}
            value={form.notes}
            onChange={updateField("notes")}
            rows={1}
            maxLength={500}
            placeholder="Why this source belongs"
            className="min-h-12 w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--ink)] shadow-sm outline-none transition duration-150 placeholder:text-[color:var(--ink-muted)] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <Button type="submit">
            <Plus className="size-4" />
            Add feed
          </Button>
          {drafts.length > 0 ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyYaml(contributionYaml, "Copied queued feed YAML.")}
              >
                <Clipboard className="size-4" />
                Copy all YAML
              </Button>
              <a
                href={githubIssueHref}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "secondary" })}
              >
                <Github className="size-4" />
                Open issue
              </a>
            </>
          ) : null}
        </div>
      </form>

      <div className="mt-3 min-h-5 text-sm" aria-live="polite">
        {formError ? <p className="text-destructive">{formError}</p> : null}
        {status ? (
          <p className="inline-flex items-center gap-2 text-(--brand-strong)">
            <Check className="size-4" />
            {status}
          </p>
        ) : null}
      </div>

      {drafts.length > 0 ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Contribution queue</h3>
            <div className="grid gap-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-lg border border-border bg-background p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-foreground [overflow-wrap:anywhere]">
                        {draft.title || draft.url}
                      </p>
                      <p className="break-words text-muted-foreground [overflow-wrap:anywhere]">
                        {draft.url}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Copy YAML for ${draft.title || draft.url}`}
                        onClick={() =>
                          void copyYaml(
                            draftToYaml(draft),
                            `Copied YAML for ${draft.title || draft.url}.`,
                          )
                        }
                      >
                        <Clipboard className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${draft.title || draft.url}`}
                        onClick={() => removeDraft(draft.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {draft.topics.map((topic) => (
                      <Badge key={`${draft.id}-${topic}`} variant="outline" className="rounded-md">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor={`${formId}-yaml`} className="field-label">
              Contribution YAML
            </label>
            <textarea
              id={`${formId}-yaml`}
              readOnly
              value={contributionYaml}
              rows={Math.min(12, Math.max(6, contributionYaml.split("\n").length))}
              className={cn(
                "min-h-40 w-full rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-foreground shadow-inner outline-none",
                "focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]",
              )}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
