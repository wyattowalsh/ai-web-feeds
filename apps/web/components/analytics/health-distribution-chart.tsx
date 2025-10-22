'use client';

import { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface HealthDistribution {
  healthy: number;
  moderate: number;
  unhealthy: number;
}

export function HealthDistributionChart({ dateRange = '30d', topic }: {
  dateRange?: string;
  topic?: string;
}) {
  const [distribution, setDistribution] = useState<HealthDistribution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDistribution = async () => {
      setLoading(true);
      
      try {
        const params = new URLSearchParams({ date_range: dateRange });
        if (topic) params.set('topic', topic);
        
        const response = await fetch(`/api/analytics/summary?${params}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        setDistribution(data.health_distribution);
      } catch (err) {
        console.error('Error fetching health distribution:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDistribution();
  }, [dateRange, topic]);

  if (loading || !distribution) {
    return (
      <div className="bg-gray-200 rounded-lg h-96 animate-pulse flex items-center justify-center">
        <p className="text-gray-600">Loading health distribution...</p>
      </div>
    );
  }

  const total = distribution.healthy + distribution.moderate + distribution.unhealthy;

  const chartData = {
    labels: ['Healthy (≥0.8)', 'Moderate (0.5-0.8)', 'Unhealthy (<0.5)'],
    datasets: [
      {
        label: 'Feed Count',
        data: [distribution.healthy, distribution.moderate, distribution.unhealthy],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgb(16, 185, 129)',
          'rgb(251, 191, 36)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: 'Feed Health Distribution',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="h-96">
        <Pie data={chartData} options={options} />
      </div>
      
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="bg-green-50 rounded p-3">
          <p className="text-sm font-semibold text-gray-600">Healthy</p>
          <p className="text-2xl font-bold text-green-600">{distribution.healthy}</p>
          <p className="text-xs text-gray-500">
            {((distribution.healthy / total) * 100).toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-yellow-50 rounded p-3">
          <p className="text-sm font-semibold text-gray-600">Moderate</p>
          <p className="text-2xl font-bold text-yellow-600">{distribution.moderate}</p>
          <p className="text-xs text-gray-500">
            {((distribution.moderate / total) * 100).toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-red-50 rounded p-3">
          <p className="text-sm font-semibold text-gray-600">Unhealthy</p>
          <p className="text-2xl font-bold text-red-600">{distribution.unhealthy}</p>
          <p className="text-xs text-gray-500">
            {((distribution.unhealthy / total) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

