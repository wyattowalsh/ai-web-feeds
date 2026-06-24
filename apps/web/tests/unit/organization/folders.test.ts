import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDB, folders, initializeDB } from "@/lib/db";
import { createFolder, listChildFolders } from "@/lib/organization/folders-repository";

describe("folders repository", () => {
  beforeEach(async () => {
    closeDB();
    await initializeDB();
    for (const folder of await folders.getAll()) {
      await folders.delete(folder.id);
    }
  });

  afterEach(() => {
    closeDB();
  });

  it("creates root folders with incrementing positions", async () => {
    const a = await createFolder({ name: "Research" });
    const b = await createFolder({ name: "News" });
    const roots = await listChildFolders(undefined);
    expect(roots.map((f) => f.id)).toEqual([a.id, b.id]);
    expect(roots[1]?.position).toBeGreaterThan(roots[0]?.position ?? 0);
  });
});
