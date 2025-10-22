'use client';

import { useState } from 'react';
import { SummaryMetrics } from '@/components/analytics/summary-metrics';
import { TrendingTopicsChart } from '@/components/analytics/trending-topics-chart';
import { VelocityChart } from '@/components/analytics/velocity-chart';
import { HealthDistributionChart } from '@/components/analytics/health-distribution-chart';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [topic, setTopic] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleExport = async () => {
    try {
      const response = await fetch(
        `/api/analytics/export?date_range=${dateRange}`
      );
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_export_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export analytics. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Real-time feed analytics with interactive visualizations, trending topics, and health insights
            </p>
          </div>

          {/* Filters */}
          <AnalyticsFilters
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            topic={topic}
            onTopicChange={setTopic}
            onRefresh={handleRefresh}
            onExport={handleExport}
          />

          {/* Summary Metrics */}
          <SummaryMetrics
            key={`summary-${refreshKey}`}
            dateRange={dateRange}
            topic={topic}
          />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trending Topics */}
            <TrendingTopicsChart
              key={`trending-${refreshKey}`}
              dateRange={dateRange}
              limit={10}
            />

            {/* Health Distribution */}
            <HealthDistributionChart
              key={`health-${refreshKey}`}
              dateRange={dateRange}
              topic={topic}
            />
          </div>

          {/* Publication Velocity */}
          <VelocityChart
            key={`velocity-${refreshKey}`}
            dateRange={dateRange}
            granularity="daily"
          />

          {/* Footer Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900">ℹ️ About Analytics</h3>
            <p className="text-sm text-blue-800 mt-1">
              Analytics are calculated based on feed validation frequency (used as a proxy for publication activity).
              Health scores categorize feeds as: <strong>Healthy</strong> (≥0.8), <strong>Moderate</strong> (0.5-0.8),
              or <strong>Unhealthy</strong> (&lt;0.5). Trending topics are ranked by validation frequency weighted
              by feed health scores. Data is cached for performance: static metrics (1 hour), dynamic metrics (5 minutes).
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <a
                href="/docs/features/analytics"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                📚 Documentation
              </a>
              <a
                href="/api/analytics/summary"
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                🔗 API Endpoint
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

