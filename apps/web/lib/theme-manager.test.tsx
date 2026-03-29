import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Preferences } from "./db";

const DEFAULT_PREFERENCES: Preferences = {
  id: "user_prefs",
  theme: "system",
  fontSize: 16,
  fontFamily: "system-ui",
  readingWidth: "medium",
  layout: "cards",
  showImages: true,
  showSummaries: true,
  markAsReadOnScroll: false,
  keyboardShortcuts: {
    j: "next_article",
    k: "previous_article",
    m: "mark_as_read",
    s: "star",
    v: "open_original",
    r: "refresh",
    "/": "search",
    "g h": "go_home",
    "g s": "go_starred",
    "g u": "go_unread",
    escape: "close_modal",
  },
  offlineMode: false,
  syncOnStartup: true,
  updatedAt: 0,
};

type MatchMediaController = {
  mediaQuery: MediaQueryList;
  setMatches: (matches: boolean) => void;
};

function installMatchMedia(matches: boolean): MatchMediaController {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === "change") {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === "change") {
        listeners.delete(listener);
      }
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => mediaQuery),
  });

  return {
    mediaQuery,
    setMatches(nextMatches: boolean) {
      Object.assign(mediaQuery, { matches: nextMatches });
      listeners.forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent));
    },
  };
}

async function loadThemeModule(
  overrides: Partial<Preferences> = {},
  options: { prefersDark?: boolean; includeMeta?: boolean } = {},
) {
  vi.resetModules();
  document.documentElement.className = "";
  document.documentElement.style.cssText = "";
  document.documentElement.removeAttribute("data-layout");
  document.head.innerHTML = options.includeMeta === false
    ? ""
    : '<meta name="theme-color" content="#ffffff">';

  const matchMedia = installMatchMedia(options.prefersDark ?? false);

  let currentPrefs: Preferences = {
    ...DEFAULT_PREFERENCES,
    ...overrides,
  };

  const preferences = {
    get: vi.fn(async () => currentPrefs),
    update: vi.fn(async (updates: Partial<Preferences>) => {
      currentPrefs = {
        ...currentPrefs,
        ...updates,
        updatedAt: currentPrefs.updatedAt + 1,
      };
    }),
  };

  vi.doMock("./db", () => ({
    preferences,
  }));

  const themeModule = await import("./theme-manager");

  await waitFor(() => {
    expect(preferences.get).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(document.documentElement.style.getPropertyValue("--font-size-base")).toBe(
      `${currentPrefs.fontSize}px`,
    );
  });

  return {
    themeModule,
    matchMedia,
    preferences,
    getPreferences: () => currentPrefs,
  };
}

describe("theme-manager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = "";
    document.documentElement.className = "";
    document.documentElement.style.cssText = "";
    document.documentElement.removeAttribute("data-layout");
  });

  it("initializes using saved preferences and the system theme", async () => {
    await loadThemeModule(
      {
        theme: "system",
        fontSize: 18,
        fontFamily: "Inter",
        readingWidth: "wide",
        layout: "compact",
      },
      { prefersDark: true },
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
    });

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", "#1a1a1a");
    expect(document.documentElement.style.getPropertyValue("--color-background")).toBe("#1f2530");
    expect(document.documentElement.style.getPropertyValue("--font-size-base")).toBe("18px");
    expect(document.documentElement.style.getPropertyValue("--font-family")).toBe("Inter");
    expect(document.documentElement.style.getPropertyValue("--reading-width")).toBe("1000px");
    expect(document.documentElement.getAttribute("data-layout")).toBe("compact");
  });

  it("syncs system theme changes only while the theme mode is system", async () => {
    const { themeModule, matchMedia } = await loadThemeModule({ theme: "system" }, { prefersDark: false });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("light");
    });

    matchMedia.setMatches(true);
    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
    });

    await themeModule.themeManager.setTheme("light");
    expect(themeModule.themeManager.getTheme()).toBe("light");

    matchMedia.setMatches(false);
    expect(document.documentElement).toHaveClass("light");
  });

  it("persists theme updates, notifies listeners, and supports unsubscribing", async () => {
    const { themeModule, preferences } = await loadThemeModule({ theme: "light" });

    const listener = vi.fn();
    const unsubscribe = themeModule.themeManager.addListener(listener);

    await themeModule.themeManager.setTheme("dark");
    expect(preferences.update).toHaveBeenCalledWith({ theme: "dark" });
    expect(themeModule.themeManager.getEffectiveThemeMode()).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(listener).toHaveBeenCalledWith("dark");

    unsubscribe();
    await themeModule.themeManager.setTheme("light");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(document.documentElement).toHaveClass("light");
  });

  it("toggles theme from the effective mode and exports CSS variables", async () => {
    const { themeModule } = await loadThemeModule({ theme: "system" }, { prefersDark: true });

    await themeModule.themeManager.toggleTheme();

    expect(themeModule.themeManager.getTheme()).toBe("light");
    expect(themeModule.themeManager.getEffectiveThemeMode()).toBe("light");
    expect(document.documentElement).toHaveClass("light");

    const css = themeModule.themeManager.exportThemeCSS();
    expect(css).toContain("--color-background-secondary: #fffdfa;");
    expect(css).toContain("--color-link-text: #4a5fd4;");
  });

  it("updates font, layout, and image preferences", async () => {
    const { themeModule, preferences, getPreferences } = await loadThemeModule();

    await themeModule.themeManager.setFontSize(20);
    await themeModule.themeManager.setFontFamily("IBM Plex Sans");
    await themeModule.themeManager.setReadingWidth("narrow");
    await themeModule.themeManager.setLayout("list");
    await themeModule.themeManager.toggleImages();

    expect(preferences.update).toHaveBeenCalledWith({ fontSize: 20 });
    expect(preferences.update).toHaveBeenCalledWith({ fontFamily: "IBM Plex Sans" });
    expect(preferences.update).toHaveBeenCalledWith({ readingWidth: "narrow" });
    expect(preferences.update).toHaveBeenCalledWith({ layout: "list" });
    expect(preferences.update).toHaveBeenCalledWith({ showImages: false });

    expect(document.documentElement.style.getPropertyValue("--font-size-base")).toBe("20px");
    expect(document.documentElement.style.getPropertyValue("--font-family")).toBe("IBM Plex Sans");
    expect(document.documentElement.style.getPropertyValue("--reading-width")).toBe("600px");
    expect(document.documentElement.getAttribute("data-layout")).toBe("list");
    expect(getPreferences().showImages).toBe(false);
  });

  it("handles a missing theme meta tag without throwing", async () => {
    const { themeModule } = await loadThemeModule({ theme: "light" }, { includeMeta: false });

    await expect(themeModule.themeManager.setTheme("dark")).resolves.toBeUndefined();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("exposes working theme and font-size hooks", async () => {
    const { themeModule } = await loadThemeModule({ theme: "light", fontSize: 19 });

    function ThemeProbe() {
      const { theme, effectiveTheme, isDark, toggleTheme, setTheme } = themeModule.useTheme();

      return (
        <div>
          <div data-testid="theme">{theme}</div>
          <div data-testid="effective-theme">{effectiveTheme}</div>
          <div data-testid="is-dark">{String(isDark)}</div>
          <button onClick={() => void toggleTheme()}>toggle theme</button>
          <button onClick={() => void setTheme("light")}>force light</button>
        </div>
      );
    }

    function FontSizeProbe() {
      const { fontSize, setFontSize } = themeModule.useFontSize();

      return (
        <div>
          <div data-testid="font-size">{fontSize}</div>
          <button onClick={() => void setFontSize(24)}>set font size</button>
        </div>
      );
    }

    render(
      <>
        <ThemeProbe />
        <FontSizeProbe />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("theme")).toHaveTextContent("light");
      expect(screen.getByTestId("effective-theme")).toHaveTextContent("light");
      expect(screen.getByTestId("font-size")).toHaveTextContent("19");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "toggle theme" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("theme")).toHaveTextContent("dark");
      expect(screen.getByTestId("effective-theme")).toHaveTextContent("dark");
      expect(screen.getByTestId("is-dark")).toHaveTextContent("true");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "set font size" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("font-size")).toHaveTextContent("24");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "force light" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("theme")).toHaveTextContent("light");
      expect(screen.getByTestId("effective-theme")).toHaveTextContent("light");
    });
  });
});
