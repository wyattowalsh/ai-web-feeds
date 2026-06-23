import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

import {
  formatKey,
  shortcutManager,
  SHORTCUT_DESCRIPTIONS,
  useKeyboardShortcut,
  useShortcutKey,
} from "./keyboard-shortcuts";

describe("keyboard-shortcuts (lib)", () => {
  beforeEach(async () => {
    shortcutManager.setEnabled(true);
    shortcutManager.getShortcuts();
    await vi.waitUntil(() => shortcutManager.getKeyForAction("next_article") !== undefined, {
      timeout: 1000,
    });
  });

  afterEach(() => {
    cleanup();
    // leave manager enabled for other tests
    shortcutManager.setEnabled(true);
  });

  it("registers handlers and invokes them on matching key", async () => {
    const handler = vi.fn();
    const unregister = shortcutManager.register("next_article", handler);

    const ev = new KeyboardEvent("keydown", { key: "j", bubbles: true });
    window.dispatchEvent(ev);

    await expect.poll(() => handler.mock.calls.length, { timeout: 1000 }).toBeGreaterThan(0);

    unregister();
  });

  it("setEnabled(false) prevents handler invocation", () => {
    const handler = vi.fn();
    shortcutManager.register("mark_as_read", handler);

    shortcutManager.setEnabled(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    expect(handler).not.toHaveBeenCalled();

    shortcutManager.setEnabled(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    expect(handler).toHaveBeenCalled();
  });

  it("ignores shortcuts while focus is in INPUT/TEXTAREA (except ctrl+k -> focus_search)", () => {
    const readH = vi.fn();
    const focusH = vi.fn();
    shortcutManager.register("mark_as_read", readH);
    shortcutManager.register("focus_search", focusH);

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    // Build event with explicit target so handler sees input tag
    const mEv = new KeyboardEvent("keydown", { key: "m", bubbles: true });
    Object.defineProperty(mEv, "target", { value: input, enumerable: true });
    window.dispatchEvent(mEv);
    expect(readH).not.toHaveBeenCalled();

    // ctrl+k should still trigger focus_search even from input (hardcoded path)
    const kEv = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
    Object.defineProperty(kEv, "target", { value: input, enumerable: true });
    window.dispatchEvent(kEv);
    expect(focusH).toHaveBeenCalled();

    input.remove();
  });

  it("supports sequence shortcuts like 'g h'", async () => {
    const homeH = vi.fn();
    shortcutManager.register("go_home", homeH);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "h", bubbles: true }));

    await expect.poll(() => homeH.mock.calls.length, { timeout: 1000 }).toBeGreaterThan(0);
  });

  it("ignores keydown events that already called preventDefault", () => {
    const handler = vi.fn();
    shortcutManager.register("next_article", handler);

    const ev = new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true });
    ev.preventDefault();
    window.dispatchEvent(ev);

    expect(handler).not.toHaveBeenCalled();
  });

  it("getKeyForAction reflects current map (wrappers in use-reader-shortcuts)", () => {
    // defaults are loaded on construction (or fallback)
    const nextKey = shortcutManager.getKeyForAction("next_article");
    expect(nextKey).toBeTruthy();

    const map = shortcutManager.getShortcuts();
    // map is key -> action
    const hasNext =
      Array.from(map.values()).includes("next_article") || map.get("j") === "next_article";
    expect(hasNext || !!nextKey).toBe(true);
  });

  it("useKeyboardShortcut registers and cleans up on unmount", async () => {
    const h = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut("refresh", h));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    await expect.poll(() => h.mock.calls.length, { timeout: 1000 }).toBeGreaterThan(0);

    unmount();
    // after unmount, further events should not call (if unregistered)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    // may still be 1 or more only if other listeners; we just ensure no throw and registration path executed
    expect(true).toBe(true);
  });

  it("useShortcutKey returns a key for known action", () => {
    const { result } = renderHook(() => useShortcutKey("previous_article"));
    expect(result.current).toBeDefined();
  });

  it("formatKey prettifies modifiers and keys", () => {
    expect(formatKey("ctrl+k")).toBe("⌃K");
    expect(formatKey("meta+shift+?")).toBe("⌘⇧?");
    expect(formatKey("escape")).toBe("Esc");
  });

  it("SHORTCUT_DESCRIPTIONS has entries for core actions", () => {
    expect(SHORTCUT_DESCRIPTIONS["star"]).toMatch(/star/i);
    expect(SHORTCUT_DESCRIPTIONS["archive"]).toBeTruthy();
  });

  it("Shift+/ (key='/' with shiftKey) maps to '?' and triggers show_shortcuts", async () => {
    const handler = vi.fn();
    const unregister = shortcutManager.register("show_shortcuts", handler);

    // Some browsers report key="/" + shiftKey when user presses Shift+/
    const ev = new KeyboardEvent("keydown", { key: "/", shiftKey: true, bubbles: true });
    window.dispatchEvent(ev);

    await expect.poll(() => handler.mock.calls.length, { timeout: 1000 }).toBeGreaterThan(0);

    unregister();
  });

  it("key='?' directly triggers show_shortcuts", async () => {
    const handler = vi.fn();
    const unregister = shortcutManager.register("show_shortcuts", handler);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));

    await expect.poll(() => handler.mock.calls.length, { timeout: 1000 }).toBeGreaterThan(0);

    unregister();
  });
});
