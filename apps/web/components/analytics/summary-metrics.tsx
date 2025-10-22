'use client';

import { useEffect, useState } from 'react';

interface SummaryMetrics {
  total_feeds: number;
  active_feeds: number;
  validation_success_rate: number;
  avg_response_time: number;
  health_distribution: {
    healthy: number;
    moderate: number;
    unhealthy: number;
  };
  last_updated: string;
}

export function SummaryMetrics({
  dateRange = '30d',
  topic,
}: {
  dateRange?: string;
  topic?: string;
}) {
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({ date_range: dateRange });
        if (topic) params.set('topic', topic);
        
        const response = await fetch(`/api/analytics/summary?${params}`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [dateRange, topic]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-32" />
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold">Error loading metrics</p>
        <p className="text-sm">{error || 'No data available'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Summary Metrics</h2>
        <p className="text-sm text-gray-600">
          Last updated: {new Date(metrics.last_updated).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Feeds"
          value={metrics.total_feeds.toLocaleString()}
          icon="📊"
        />
        <MetricCard
          title="Active Feeds"
          value={metrics.active_feeds.toLocaleString()}
          subtitle={`${((metrics.active_feeds / metrics.total_feeds) * 100).toFixed(1)}% of total`}
          icon="✅"
        />
        <MetricCard
          title="Success Rate"
          value={`${(metrics.validation_success_rate * 100).toFixed(1)}%`}
          subtitle="Validation success"
          icon="🎯"
          color="green"
        />
        <MetricCard
          title="Avg Response Time"
          value={`${metrics.avg_response_time.toFixed(0)} ms`}
          icon="⚡"
        />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

