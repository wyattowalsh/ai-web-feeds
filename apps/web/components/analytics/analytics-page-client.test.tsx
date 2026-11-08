import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("chart.js", () => {
  class Chart {
    static register(): void {}
  }

  return {
    Chart,
    ArcElement: {},
    BarElement: {},
    CategoryScale: {},
    Filler: {},
    Legend: {},
    LinearScale: {},
    LineElement: {},
    PointElement: {},
    Title: {},
    Tooltip: {},
  };
});

vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="trending-bars" />,
  Line: () => <div data-testid="velocity-line" />,
  Pie: () => <div data-testid="health-pie" />,
}));

vi.mock("@/lib/theme-manager", () => ({
  useTheme: () => ({ isDark: false }),
}));

import { AnalyticsPageClient } from "./analytics-page-client";

const source = readFileSync(
  join(process.cwd(), "components/analytics/analytics-page-client.tsx"),
  "utf8",
);

const summaryPayload = {
  total_feeds: 1847,
  active_feeds: 1203,
  validation_success_rate: 0.876,
  avg_response_time: 245.4,
  health_distribution: {
    healthy: 911,
    moderate: 203,
    unhealthy: 107,
  },
  last_updated: "2026-01-15T12:00:00.000Z",
  demo: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(handlers: {
  summary: () => Response;
  trending?: () => Response;
  velocity?: () => Response;
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/analytics/summary")) {
      return handlers.summary();
    }
    if (url.startsWith("/api/analytics/trending")) {
      return (handlers.trending ?? (() => jsonResponse({ demo: false, points: [] })))();
    }
    if (url.startsWith("/api/analytics/velocity")) {
      return (handlers.velocity ?? (() => jsonResponse({ demo: false, points: [] })))();
    }
    return jsonResponse({ error: "unexpected" }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AnalyticsPageClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled");
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the chart names and does not use Math.random", () => {
    expect(source).toContain("export function AnalyticsPageClient");
    expect(source).toContain("SummaryMetrics");
    expect(source).toContain("TrendingTopicsChart");
    expect(source).toContain("VelocityChart");
    expect(source).toContain("HealthDistributionChart");
    expect(source).toContain("AnalyticsFilters");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("demo: true");
    expect(source).not.toContain("ChartBuilder");
    expect(source.toLowerCase()).not.toContain("forecast");
  });

  it("renders summary totals and health distribution counts from the summary payload", async () => {
    const fetchMock = installFetch({
      summary: () => jsonResponse(summaryPayload),
      trending: () => jsonResponse({ demo: false, points: [] }),
      velocity: () => jsonResponse({ demo: false, points: [] }),
    });

    render(<AnalyticsPageClient />);

    expect(
      await screen.findByText(summaryPayload.total_feeds.toLocaleString()),
    ).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Summary metrics" });
    const health = screen.getByRole("region", { name: "Health distribution" });

    expect(summary).toHaveAttribute("data-state", "ready");
    expect(summary).toHaveAttribute("data-demo", "false");
    expect(summary).toHaveTextContent("911");
    expect(summary).toHaveTextContent("203");
    expect(summary).toHaveTextContent("107");
    expect(health).toHaveAttribute("data-state", "ready");
    expect(health).toHaveTextContent("911");
    expect(health).toHaveTextContent("203");
    expect(health).toHaveTextContent("107");
    expect(screen.getByTestId("health-pie")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Trending topics" })).toHaveAttribute(
      "data-state",
      "empty",
    );
    expect(screen.getByRole("region", { name: "Publication velocity" })).toHaveAttribute(
      "data-state",
      "empty",
    );
    expect(screen.queryByTestId("trending-bars")).not.toBeInTheDocument();
    expect(screen.queryByTestId("velocity-line")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/summary?date_range=30d",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/trending?limit=10",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/velocity?date_range=30d&granularity=daily",
      expect.objectContaining({ cache: "no-store" }),
    );

    fireEvent.change(screen.getByLabelText("Topic focus"), { target: { value: "agents" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics/summary?date_range=30d&topic=agents",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(screen.getByLabelText("Time range")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Time range"), { target: { value: "7d" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics/summary?date_range=7d&topic=agents",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics/velocity?date_range=7d&granularity=daily",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(screen.getByLabelText("Time range")).toHaveValue("7d");
    });

    expect(
      await screen.findByText(summaryPayload.total_feeds.toLocaleString()),
    ).toBeInTheDocument();
  });

  it("renders a trending topic and a velocity date from catalog points", async () => {
    installFetch({
      summary: () => jsonResponse(summaryPayload),
      trending: () =>
        jsonResponse({
          demo: false,
          points: [
            {
              topic: "retrieval",
              feed_count: 12,
              validation_frequency: 40,
              avg_health_score: 0.91,
            },
            {
              topic: "count-only",
              feed_count: 4,
              count: 4,
              avg_health_score: 0.4,
            },
            {
              topic: "string-frequency",
              feed_count: 2,
              validation_frequency: "10",
              avg_health_score: 0.5,
            },
          ],
        }),
      velocity: () =>
        jsonResponse({
          demo: false,
          points: [
            { date: "2026-11-02", count: 6 },
            { date: "2026-10-01", count: "6" },
            { date: "", count: 3 },
          ],
          avg_per_feed: 2.5,
          most_active_feed: { id: "alpha", title: "Invented Feed", count: 9 },
        }),
    });

    render(<AnalyticsPageClient />);

    expect(await screen.findByText("retrieval")).toBeInTheDocument();
    expect(screen.getByText("2026-11-02")).toBeInTheDocument();
    expect(screen.getByTestId("trending-bars")).toBeInTheDocument();
    expect(screen.getByTestId("velocity-line")).toBeInTheDocument();
    expect(screen.queryByText("count-only")).not.toBeInTheDocument();
    expect(screen.queryByText("string-frequency")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-10-01")).not.toBeInTheDocument();
    expect(screen.queryByText("Average per feed")).not.toBeInTheDocument();
    expect(screen.queryByText("Most active")).not.toBeInTheDocument();
    expect(screen.queryByText("Least active")).not.toBeInTheDocument();
    expect(screen.queryByText("Invented Feed")).not.toBeInTheDocument();
  });

  it("shows a trending error without a made-up topic", async () => {
    installFetch({
      summary: () => jsonResponse(summaryPayload),
      trending: () =>
        jsonResponse(
          {
            error: "Trending snapshot failed",
            demo: false,
            points: [
              {
                topic: "Invented Topic",
                feed_count: 9,
                validation_frequency: 9,
                avg_health_score: 0.9,
              },
            ],
          },
          500,
        ),
      velocity: () =>
        jsonResponse({
          demo: false,
          points: [{ date: "2026-11-03", count: 4 }],
        }),
    });

    render(<AnalyticsPageClient />);

    const trending = await screen.findByRole("region", { name: "Trending topics" });
    const alert = screen.getByRole("alert");

    expect(trending).toContainElement(alert);
    expect(alert).toHaveTextContent("Trending snapshot failed");
    expect(screen.queryByText("Invented Topic")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trending-bars")).not.toBeInTheDocument();
    expect(screen.getByText("2026-11-03")).toBeInTheDocument();
    expect(screen.getByTestId("velocity-line")).toBeInTheDocument();
  });

  it("shows a summary error without inventing catalog counts", async () => {
    installFetch({
      summary: () =>
        jsonResponse(
          {
            error: "Summary query failed",
            total_feeds: 0,
            active_feeds: 0,
            validation_success_rate: 0,
            avg_response_time: 0,
            health_distribution: { healthy: 0, moderate: 0, unhealthy: 0 },
          },
          500,
        ),
      trending: () => jsonResponse({ demo: false, points: [] }),
      velocity: () => jsonResponse({ demo: false, points: [] }),
    });

    render(<AnalyticsPageClient />);

    expect(await screen.findByText("Summary query failed")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Summary metrics" })).toHaveAttribute(
      "data-state",
      "error",
    );
    expect(screen.queryByText("Total feeds")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Health distribution" })).toHaveAttribute(
      "data-state",
      "empty",
    );
    expect(screen.queryByTestId("health-pie")).not.toBeInTheDocument();
    expect(document.querySelector("[data-health-count]")).toBeNull();
    expect(screen.queryByText("Analytics backend unavailable")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Time range")).toBeInTheDocument();
  });

  it("shows the unavailable empty state for 503 or FEATURE_UNAVAILABLE", async () => {
    const unavailableSummary = installFetch({
      summary: () =>
        jsonResponse(
          {
            error: "Analytics service is offline",
            code: "FEATURE_UNAVAILABLE",
            total_feeds: 99999,
            health_distribution: { healthy: 4, moderate: 5, unhealthy: 6 },
          },
          503,
        ),
      trending: () =>
        jsonResponse({
          demo: false,
          points: [
            {
              topic: "Invented Topic",
              feed_count: 1,
              validation_frequency: 1,
              avg_health_score: 1,
            },
          ],
        }),
    });

    const { unmount } = render(<AnalyticsPageClient />);

    expect(await screen.findByText("Analytics backend unavailable")).toBeInTheDocument();
    expect(screen.getByText("Analytics service is offline")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Summary metrics" })).not.toBeInTheDocument();
    expect(screen.queryByText("99999")).not.toBeInTheDocument();
    expect(screen.queryByText("Invented Topic")).not.toBeInTheDocument();
    expect(screen.queryByText("Checking backend availability")).not.toBeInTheDocument();
    expect(
      unavailableSummary.mock.calls.some((call) =>
        String(call[0]).startsWith("/api/analytics/trending"),
      ),
    ).toBe(false);
    expect(
      unavailableSummary.mock.calls.some((call) =>
        String(call[0]).startsWith("/api/analytics/velocity"),
      ),
    ).toBe(false);

    unmount();

    const featureUnavailable = installFetch({
      summary: () =>
        jsonResponse(
          {
            error: "Analytics feature is turned off",
            code: "FEATURE_UNAVAILABLE",
          },
          501,
        ),
    });

    render(<AnalyticsPageClient />);

    expect(await screen.findByText("Analytics backend unavailable")).toBeInTheDocument();
    expect(screen.getByText("Analytics feature is turned off")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Summary metrics" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open catalog" })).toBeInTheDocument();
    expect(
      featureUnavailable.mock.calls.some((call) =>
        String(call[0]).startsWith("/api/analytics/trending"),
      ),
    ).toBe(false);
  });
});
