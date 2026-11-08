import { createElement } from "react";

import { render } from "@testing-library/react";
import axe, { type Result } from "axe-core";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

import {
  PLAYWRIGHT_AXE_OPTIONS,
  buildAxeFailureMessage,
  summarizeAxeViolations,
} from "./axe-tests";

describe("axe accessibility", () => {
  it("finds no violations for a named Button inside main", async () => {
    document.documentElement.lang = "en";
    document.title = "Feed catalog";

    const { container } = render(
      createElement(
        "main",
        null,
        createElement("h1", null, "Feed catalog"),
        createElement(Button, { type: "button" }, "Refresh feeds"),
      ),
    );

    const results: { violations: Result[] } = await axe.run(container, {
      ...PLAYWRIGHT_AXE_OPTIONS,
      rules: {
        // jsdom cannot compute color contrast
        "color-contrast": { enabled: false },
      },
    });
    const summary = summarizeAxeViolations(results.violations);

    expect(summary, buildAxeFailureMessage("named Button", summary)).toEqual([]);
  });

  it("summarizes an empty list and a non-empty failure message", () => {
    expect(summarizeAxeViolations([])).toEqual([]);

    const violation: Result = {
      id: "button-name",
      impact: "critical",
      description: "Ensures buttons have discernible text",
      help: "Buttons must have discernible text",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.11/button-name",
      tags: ["wcag2a"],
      nodes: [],
    };
    const summary = summarizeAxeViolations([violation]);
    const message = buildAxeFailureMessage("fixture", summary);

    expect(summary).not.toEqual([]);
    expect(message).not.toBe("");
    expect(message).toContain("button-name");
  });
});
