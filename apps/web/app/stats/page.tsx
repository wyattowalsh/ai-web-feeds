import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Validation Stats - AIWebFeeds",
  description: "Feed validation statistics and health metrics for the AIWebFeeds collection.",
  openGraph: {
    title: "Validation Stats - AIWebFeeds",
    description: "Feed validation statistics and health metrics",
  },
};

async function getValidationStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/stats/validation`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!res.ok) throw new Error("Failed to fetch stats");

    return await res.json();
  } catch (error) {
    console.error("Error fetching validation stats:", error);
    // Return default stats on error
    return {
      total_feeds: 0,
      validated_feeds: 0,
      success_count: 0,
      failure_count: 0,
      success_rate: 0,
      avg_response_time_ms: 0,
      healthy_feeds: 0,
      avg_health_score: 0,
      last_validation_run: null,
      top_errors: [],
    };
  }
}

export default async function StatsPage() {
  const stats = await getValidationStats();

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Validation Statistics</h1>
        <p className="text-lg text-muted-foreground">
          Real-time validation health metrics for the AIWebFeeds collection
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-lg p-6 bg-card">
          <div className="text-sm text-muted-foreground mb-1">Total Feeds</div>
          <div className="text-3xl font-bold">{stats.total_feeds}</div>
          <div className="text-xs text-muted-foreground mt-2">In collection</div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <div className="text-sm text-muted-foreground mb-1">Success Rate</div>
          <div className="text-3xl font-bold text-green-600">{stats.success_rate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground mt-2">
            {stats.success_count} / {stats.validated_feeds} validated
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <div className="text-sm text-muted-foreground mb-1">Avg Response Time</div>
          <div className="text-3xl font-bold">
            {stats.avg_response_time_ms}
            <span className="text-lg">ms</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">HTTP fetch time</div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <div className="text-sm text-muted-foreground mb-1">Health Score</div>
          <div className="text-3xl font-bold">{stats.avg_health_score.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-2">Average (0.0-1.0 scale)</div>
        </div>
      </div>

      {/* Success/Failure Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Validation Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span>Successful</span>
              </div>
              <div className="text-lg font-semibold">{stats.success_count}</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{
                  width: `${(stats.success_count / stats.validated_feeds) * 100}%`,
                }}
              ></div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span>Failed</span>
              </div>
              <div className="text-lg font-semibold">{stats.failure_count}</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{
                  width: `${(stats.failure_count / stats.validated_feeds) * 100}%`,
                }}
              ></div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                <span>Not Validated</span>
              </div>
              <div className="text-lg font-semibold">
                {stats.total_feeds - stats.validated_feeds}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gray-400 h-2 rounded-full"
                style={{
                  width: `${
                    ((stats.total_feeds - stats.validated_feeds) / stats.total_feeds) * 100
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">Health Distribution</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Healthy (≥0.8)</span>
                <span className="text-sm font-semibold">{stats.healthy_feeds} feeds</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{
                    width: `${(stats.healthy_feeds / stats.total_feeds) * 100}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Health score is calculated based on success rate (80%) and response time (20%).
                Feeds with scores ≥0.8 are considered healthy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Command */}
      <div className="border rounded-lg p-6 bg-card">
        <h2 className="text-xl font-semibold mb-4">Run Validation</h2>
        <p className="text-sm text-muted-foreground mb-4">
          To validate all feeds and update these metrics, run:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>uv run aiwebfeeds validate http</code>
        </pre>
        <p className="text-xs text-muted-foreground mt-3">
          This will check HTTP accessibility, parse feeds, and store validation results in the
          database.
        </p>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Stats refreshed every 5 minutes. Last update: {stats.last_validation_run || "Never"}</p>
      </div>
    </div>
  );
}
