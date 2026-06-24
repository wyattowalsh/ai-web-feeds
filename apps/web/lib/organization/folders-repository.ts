import { folders, type Folder } from "@/lib/db";

export async function listFolders(): Promise<Folder[]> {
  const all = await folders.getAll();
  return all.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export async function listChildFolders(parentId: string | undefined): Promise<Folder[]> {
  const all = await listFolders();
  const key = parentId ?? "";
  return all.filter((folder) => (folder.parentId ?? "") === key);
}

export async function createFolder(input: {
  name: string;
  parentId?: string;
  color?: string;
}): Promise<Folder> {
  const siblings = await listChildFolders(input.parentId);
  const now = Date.now();
  const folder: Folder = {
    id: `folder_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    parentId: input.parentId,
    position: siblings.length,
    collapsed: false,
    color: input.color,
    createdAt: now,
    updatedAt: now,
  };
  await folders.put(folder);
  return folder;
}

export async function reorderFolder(folderId: string, newPosition: number): Promise<void> {
  const folder = await folders.get(folderId);
  if (!folder) return;
  await folders.put({ ...folder, position: newPosition, updatedAt: Date.now() });
}

export async function deleteFolder(folderId: string): Promise<void> {
  await folders.delete(folderId);
}
