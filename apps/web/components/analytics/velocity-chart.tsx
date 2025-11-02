'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface VelocityData {
  granularity: string;
  data_points: Array<{ date: string; count: number }>;
  avg_per_feed: number;
  most_active_feed: { id: string; title: string; count: number } | null;
  least_active_feed: { id: string; title: string; count: number } | null;
}

export function VelocityChart({
  dateRange = '30d',
  granularity = 'daily',
}: {
  dateRange?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}) {
  const [velocity, setVelocity] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVelocity = async () => {
      setLoading(true);
      
      try {
        const response = await fetch(
          `/api/analytics/velocity?granularity=${granularity}&date_range=${dateRange}`
        );
        if (!response.ok) throw new Error('Failed to fetch velocity data');
        
        const data = await response.json();
        setVelocity(data);
      } catch (err) {
        console.error('Error fetching velocity:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVelocity();
  }, [dateRange, granularity]);

  if (loading || !velocity) {
    return (
      <div className="bg-gray-200 rounded-lg h-96 animate-pulse flex items-center justify-center">
        <p className="text-gray-600">Loading publication velocity...</p>
      </div>
    );
  }

  const chartData = {
    labels: velocity.data_points.map((dp) => dp.date),
    datasets: [
      {
        label: 'Validation Count',
        data: velocity.data_points.map((dp) => dp.count),
        fill: true,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Publication Velocity (${granularity}, ${dateRange})`,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Validation Count',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="h-96">
        <Line data={chartData} options={options} />
      </div>
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-gray-50 rounded p-3">
          <p className="font-semibold text-gray-600">Average per Feed</p>
          <p className="text-2xl font-bold text-blue-600">
            {velocity.avg_per_feed.toFixed(1)}
          </p>
        </div>
        
        {velocity.most_active_feed && (
          <div className="bg-green-50 rounded p-3">
            <p className="font-semibold text-gray-600">Most Active</p>
            <p className="text-sm font-medium">{velocity.most_active_feed.title}</p>
            <p className="text-xs text-gray-500">
              {velocity.most_active_feed.count} validations
            </p>
          </div>
        )}
        
        {velocity.least_active_feed && (
          <div className="bg-yellow-50 rounded p-3">
            <p className="font-semibold text-gray-600">Least Active</p>
            <p className="text-sm font-medium">{velocity.least_active_feed.title}</p>
            <p className="text-xs text-gray-500">
              {velocity.least_active_feed.count} validation{velocity.least_active_feed.count !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

