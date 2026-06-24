import { beforeEach, describe, expect, it, vi } from "vitest";

import { listShortcutMap, parseShortcutMapExport } from "@/lib/shortcuts/shortcut-map";
import { shortcutManager } from "@/lib/keyboard-shortcuts";

describe("shortcut-map", () => {
  beforeEach(() => {
    vi.spyOn(shortcutManager, "getShortcuts").mockReturnValue(
      new Map([
        ["j", "next_article"],
        ["k", "previous_article"],
      ]),
    );
  });

  it("lists known actions with descriptions", () => {
    const entries = listShortcutMap();
    expect(entries.some((entry) => entry.action === "next_article")).toBe(true);
    expect(entries.find((entry) => entry.action === "next_article")?.key).toBe("j");
  });

  it("parses export bundles", () => {
    const bundle = parseShortcutMapExport(
      JSON.stringify({ version: 1, exportedAt: 1, shortcuts: { j: "next_article" } }),
    );
    expect(bundle.shortcuts.j).toBe("next_article");
  });
});
