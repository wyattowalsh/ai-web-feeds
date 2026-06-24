"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { annotations } from "@/lib/db";

export function AnnotationPanel({ articleId }: { articleId: string }) {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    const now = Date.now();
    await annotations.put({
      id: `ann_${now}`,
      articleId,
      type: "note",
      content: trimmed,
      createdAt: now,
      updatedAt: now,
    });
    setNote("");
    setSaved(true);
  };

  return (
    <section className="space-y-3 rounded-lg border border-(--line) bg-(--surface) p-4">
      <h3 className="text-sm font-semibold text-(--ink)">Annotations</h3>
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a note"
        aria-label="Annotation note"
      />
      <Button type="button" size="sm" onClick={() => void save()}>
        Save note
      </Button>
      {saved ? <p className="text-xs text-(--ink-muted)">Saved locally.</p> : null}
    </section>
  );
}
