import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setNextTheme, getTheme, setTheme, nextThemeRef } = vi.hoisted(() => {
  const nextThemeRef = { value: "system" as string };
  return {
    setNextTheme: vi.fn(),
    getTheme: vi.fn(() => "dark" as const),
    setTheme: vi.fn(async () => undefined),
    nextThemeRef,
  };
});

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: nextThemeRef.value,
    setTheme: setNextTheme,
  }),
}));

vi.mock("@/lib/theme-manager", () => ({
  themeManager: {
    getTheme,
    setTheme,
  },
}));

import { HubThemeSync } from "./hub-theme-sync";

describe("HubThemeSync", () => {
  beforeEach(() => {
    setNextTheme.mockReset();
    setTheme.mockClear();
    getTheme.mockReturnValue("dark");
    nextThemeRef.value = "system";
  });

  it("aligns next-themes with saved theme-manager preference on mount", async () => {
    render(<HubThemeSync />);

    await waitFor(() => {
      expect(setNextTheme).toHaveBeenCalledWith("dark");
    });
  });

  it("persists next-themes changes into theme-manager after hydration", async () => {
    nextThemeRef.value = "light";
    getTheme.mockReturnValue("system");

    render(<HubThemeSync />);

    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith("light");
    });
  });
});
