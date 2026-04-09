import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/metric-card", () => ({
  MetricCard: ({ label, value, detail }: { label: string; value: string; detail: string }) => (
    <div>
      <p>{label}</p>
      <p>{value}</p>
      <p>{detail}</p>
    </div>
  ),
}));

import { SummaryMetrics } from "./summary-metrics";

const fetchMock = vi.fn<typeof fetch>();

describe("SummaryMetrics", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders scan coverage and source type distribution from the summary payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          total_sources: 42,
          active_sources: 38,
          posts_last_24h: 14,
          posts_last_7d: 91,
          topic_count: 12,
          source_type_distribution: [
            { source_type: "newsletter", count: 16 },
            { source_type: "blog", count: 14 },
          ],
          scan_summary: {
            matching_sources: 38,
            scanned_sources: 32,
            scan_limit: 32,
            per_source_limit: 4,
            truncated: true,
          },
          last_updated: "2026-04-06T12:00:00.000Z",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<SummaryMetrics dateRange="30d" topic="agents" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/analytics/summary?date_range=30d&topic=agents");
    });

    expect(screen.getByText("Live analytics window")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Scanning 32 of 38 matching active sources, up to 4 recent posts per source.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Filtered catalog distribution")).toBeInTheDocument();
    expect(screen.getByText("Newsletter")).toBeInTheDocument();
    expect(screen.getByText("Blog")).toBeInTheDocument();
  });
});
