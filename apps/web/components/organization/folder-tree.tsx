"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Folder as FolderIcon, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Folder } from "@/lib/db";
import { createFolder, listChildFolders } from "@/lib/organization/folders-repository";

function FolderNode({ folder, depth }: { folder: Folder; depth: number }) {
  const [children, setChildren] = useState<Folder[]>([]);
  const [open, setOpen] = useState(!folder.collapsed);

  useEffect(() => {
    void listChildFolders(folder.id).then(setChildren);
  }, [folder.id]);

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-(--surface-muted)"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight className={`size-3.5 transition ${open ? "rotate-90" : ""}`} aria-hidden />
        <FolderIcon className="size-4 text-(--ink-muted)" aria-hidden />
        <span>{folder.name}</span>
      </button>
      {open && children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <FolderNode key={child.id} folder={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FolderTree() {
  const [roots, setRoots] = useState<Folder[]>([]);
  const [name, setName] = useState("");

  const refresh = useCallback(async () => {
    setRoots(await listChildFolders(undefined));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createFolder({ name: trimmed });
    setName("");
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New folder name"
          aria-label="New folder name"
        />
        <Button type="button" variant="secondary" onClick={() => void handleCreate()}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>
      <ul className="rounded-lg border border-(--line) bg-(--surface) py-2">
        {roots.length === 0 ? (
          <li className="px-4 py-3 text-sm text-(--ink-muted)">No folders yet.</li>
        ) : (
          roots.map((folder) => <FolderNode key={folder.id} folder={folder} depth={0} />)
        )}
      </ul>
    </div>
  );
}
