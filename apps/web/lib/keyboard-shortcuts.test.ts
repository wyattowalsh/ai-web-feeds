import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadShortcutModule() {
  vi.resetModules();
  vi.doMock("./db", () => ({
    preferences: {
      get: vi.fn(async () => {
        throw new Error("missing preferences");
      }),
      update: vi.fn(async () => undefined),
    },
  }));

  const module = await import("./keyboard-shortcuts");
  await Promise.resolve();
  await Promise.resolve();
  return module;
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("keyboard shortcuts defaults", () => {
  it("loads the reader-aligned default shortcut map", async () => {
    const module = await loadShortcutModule();
    const shortcuts = module.shortcutManager.getShortcuts();

    expect(shortcuts.get("a")).toBe("archive");
    expect(shortcuts.get("g a")).toBe("go_all");
    expect(shortcuts.get("?")).toBe("show_shortcuts");
    expect(shortcuts.get("[")).toBe("toggle_sidebar");
    expect(shortcuts.get("ctrl+k")).toBe("focus_search");
    expect(shortcuts.get("meta+k")).toBe("focus_search");
  });

  it("allows cmd/meta+k to focus search even while typing in an input", async () => {
    const module = await loadShortcutModule();
    const handler = vi.fn();
    const unregister = module.shortcutManager.register("focus_search", handler);

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
  });
});
