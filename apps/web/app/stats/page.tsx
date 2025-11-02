/**
 * Reading Statistics Dashboard
 * 
 * Displays reading activity metrics including articles read, time spent,
 * favorite topics, and reading streaks.
 * 
 * @see specs/004-client-side-features/tasks.md#t045
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/indexeddb/db';

export default function StatsPage(): JSX.Element {
  const [stats, setStats] = useState({
    totalArticles:   0,
    articlesRead:    0,
    articlesStarred: 0,
    totalTime:       0,
    currentStreak:   0,
  });

  // Load reading history
  const readingHistory = useLiveQuery(() => db.reading_history.toArray());
  const articles = useLiveQuery(() => db.articles.toArray());

  useEffect(() => {
    if (articles) {
      calculateStats();
    }
  }, [articles, readingHistory]);

  const calculateStats = async () => {
    if (!articles) return;

    const readArticles = articles.filter((a) => a.readAt);
    const starredArticles = articles.filter((a) => a.starred);

    // Calculate total reading time
    const totalTime = readingHistory?.reduce((sum, entry) => {
      return sum + (entry.durationSeconds || 0);
    }, 0) || 0;

    // Calculate streak
    const streak = calculateReadingStreak(readingHistory || []);

    setStats({
      totalArticles:   articles.length,
      articlesRead:    readArticles.length,
      articlesStarred: starredArticles.length,
      totalTime,
      currentStreak:   streak,
    });
  };

  const calculateReadingStreak = (history: any[]): number => {
    if (history.length === 0) return 0;

    // Sort by date
    const sorted = history
      .map((h) => new Date(h.startedAt))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const date of sorted) {
      const readDate = new Date(date);
      readDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (currentDate.getTime() - readDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === streak) {
        streak++;
      } else if (diffDays > streak) {
        break;
      }
    }

    return streak;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold mb-6">Reading Statistics</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Total Articles */}
        <StatCard
          icon="📚"
          title="Total Articles"
          value={stats.totalArticles.toString()}
          subtitle="Cached locally"
        />

        {/* Articles Read */}
        <StatCard
          icon="✓"
          title="Articles Read"
          value={stats.articlesRead.toString()}
          subtitle={`${Math.round((stats.articlesRead / stats.totalArticles) * 100) || 0}% completion`}
        />

        {/* Starred */}
        <StatCard
          icon="⭐"
          title="Starred"
          value={stats.articlesStarred.toString()}
          subtitle="Favorited articles"
        />

        {/* Reading Time */}
        <StatCard
          icon="⏱️"
          title="Reading Time"
          value={formatTime(stats.totalTime)}
          subtitle="Total time spent"
        />

        {/* Current Streak */}
        <StatCard
          icon="🔥"
          title="Reading Streak"
          value={`${stats.currentStreak} days`}
          subtitle="Consecutive days"
        />

        {/* Average */}
        <StatCard
          icon="📊"
          title="Daily Average"
          value={stats.currentStreak > 0 ? Math.round(stats.articlesRead / stats.currentStreak).toString() : '0'}
          subtitle="Articles per day"
        />
      </div>

      {/* Recent Activity */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {readingHistory?.slice(0, 10).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
            >
              <div>
                <div className="text-sm font-medium">
                  Article Read
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(entry.startedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {formatTime(entry.durationSeconds)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string;
  subtitle: string;
}): JSX.Element {
  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}
