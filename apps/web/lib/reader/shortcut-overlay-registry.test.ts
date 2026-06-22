import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shortcutManager } from "@/lib/keyboard-shortcuts";

import {
  registerShortcutOverlay,
  resetShortcutOverlaysForTests,
} from "./shortcut-overlay-registry";

describe("shortcut-overlay-registry", () => {
  beforeEach(() => {
    resetShortcutOverlaysForTests();
    shortcutManager.setEnabled(true);
  });

  afterEach(() => {
    resetShortcutOverlaysForTests();
    shortcutManager.setEnabled(true);
  });

  it("disables shortcuts while any overlay is active", () => {
    const setEnabled = vi.spyOn(shortcutManager, "setEnabled");

    const unregisterA = registerShortcutOverlay("sheet");
    expect(setEnabled).toHaveBeenLastCalledWith(false);

    registerShortcutOverlay("palette");
    expect(setEnabled).toHaveBeenLastCalledWith(false);

    unregisterA();
    expect(setEnabled).toHaveBeenLastCalledWith(false);

    resetShortcutOverlaysForTests();
    expect(setEnabled).toHaveBeenLastCalledWith(true);
  });
});
