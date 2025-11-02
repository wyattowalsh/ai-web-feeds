/**
 * Reading Statistics Tracker
 *
 * Tracks and analyzes reading behavior:
 * - Articles read per day/week/month
 * - Reading time and completion rates
 * - Favorite topics and feeds
 * - Reading streaks
 * - Time-of-day patterns
 *
 * All data stored client-side in IndexedDB
 */

import { readingHistory, articles, type ReadingHistoryEntry, type Article } from './db';

export interface ReadingStats {
  // Basic counts
  totalArticlesRead: number;
  totalReadingTime: number; // Minutes
  averageReadingTime: number; // Minutes per article
  completionRate: number; // Percentage (0-100)

  // Time-based
  articlesThisWeek: number;
  articlesThisMonth: number;
  articlesThisYear: number;
  currentStreak: number; // Days

  // Topic analysis
  topTopics: Array<{ topic: string; count: number }>;
  topFeeds: Array<{ feedId: string; count: number }>;

  // Patterns
  readingByHour: number[]; // 24 hours
  readingByDayOfWeek: number[]; // 7 days
  readingTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  articlesRead: number;
  readingTime: number; // Minutes
  completionRate: number;
}

class ReadingStatsTracker {
  private activeSession: {
    articleId: string;
    startTime: number;
    lastScrollDepth: number;
  } | null = null;

  /**
   * Start tracking article read
   */
  startReading(articleId: string): void {
    // End previous session if exists
    if (this.activeSession) {
      this.endReading();
    }

    this.activeSession = {
      articleId,
      startTime: Date.now(),
      lastScrollDepth: 0,
    };
  }

  /**
   * Update scroll depth
   */
  updateScrollDepth(depth: number): void {
    if (this.activeSession) {
      this.activeSession.lastScrollDepth = Math.max(
        this.activeSession.lastScrollDepth,
        depth
      );
    }
  }

  /**
   * End tracking article read
   */
  async endReading(completed = false): Promise<void> {
    if (!this.activeSession) return;

    const duration = Math.floor((Date.now() - this.activeSession.startTime) / 1000);
    const scrollDepth = this.activeSession.lastScrollDepth;

    // Only save if reading for at least 5 seconds
    if (duration >= 5) {
      const entry: ReadingHistoryEntry = {
        id: `${this.activeSession.articleId}_${Date.now()}`,
        articleId: this.activeSession.articleId,
        timestamp: Date.now(),
        duration,
        scrollDepth,
        completed: completed || scrollDepth >= 90,
      };

      await readingHistory.put(entry);
    }

    this.activeSession = null;
  }

  /**
   * Get comprehensive reading statistics
   */
  async getStats(): Promise<ReadingStats> {
    const allHistory = await readingHistory.getAll();
    const allArticles = await articles.getAll();

    if (allHistory.length === 0) {
      return this.getEmptyStats();
    }

    // Basic counts
    const totalArticlesRead = allHistory.length;
    const totalReadingTime = Math.floor(
      allHistory.reduce((sum, entry) => sum + entry.duration, 0) / 60
    );
    const averageReadingTime = totalReadingTime / totalArticlesRead;
    const completionRate = (allHistory.filter((e) => e.completed).length / totalArticlesRead) * 100;

    // Time-based
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000;

    const articlesThisWeek = allHistory.filter((e) => e.timestamp >= weekAgo).length;
    const articlesThisMonth = allHistory.filter((e) => e.timestamp >= monthAgo).length;
    const articlesThisYear = allHistory.filter((e) => e.timestamp >= yearAgo).length;

    // Current streak
    const currentStreak = this.calculateStreak(allHistory);

    // Topic analysis
    const topTopics = this.getTopTopics(allHistory, allArticles);
    const topFeeds = this.getTopFeeds(allHistory);

    // Patterns
    const readingByHour = this.getReadingByHour(allHistory);
    const readingByDayOfWeek = this.getReadingByDayOfWeek(allHistory);
    const readingTrend = this.calculateTrend(allHistory);

    return {
      totalArticlesRead,
      totalReadingTime,
      averageReadingTime,
      completionRate,
      articlesThisWeek,
      articlesThisMonth,
      articlesThisYear,
      currentStreak,
      topTopics,
      topFeeds,
      readingByHour,
      readingByDayOfWeek,
      readingTrend,
    };
  }

  /**
   * Get daily statistics for a date range
   */
  async getDailyStats(startDate: Date, endDate: Date): Promise<DailyStats[]> {
    const start = startDate.getTime();
    const end = endDate.getTime();
    const history = await readingHistory.getByRange('timestamp', start, end);

    const statsByDay = new Map<string, DailyStats>();

    history.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const dateStr = date.toISOString().split('T')[0];

      if (!statsByDay.has(dateStr)) {
        statsByDay.set(dateStr, {
          date: dateStr,
          articlesRead: 0,
          readingTime: 0,
          completionRate: 0,
        });
      }

      const stats = statsByDay.get(dateStr)!;
      stats.articlesRead++;
      stats.readingTime += Math.floor(entry.duration / 60);
    });

    // Calculate completion rates
    statsByDay.forEach((stats) => {
      const dayHistory = history.filter((e) => {
        const date = new Date(e.timestamp).toISOString().split('T')[0];
        return date === stats.date;
      });
      stats.completionRate = (dayHistory.filter((e) => e.completed).length / dayHistory.length) * 100;
    });

    return Array.from(statsByDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate reading streak (consecutive days)
   */
  private calculateStreak(history: ReadingHistoryEntry[]): number {
    if (history.length === 0) return 0;

    const sortedDates = history
      .map((e) => new Date(e.timestamp).toISOString().split('T')[0])
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort()
      .reverse();

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let currentDate = today;

    for (const date of sortedDates) {
      if (date === currentDate) {
        streak++;
        const prev = new Date(currentDate);
        prev.setDate(prev.getDate() - 1);
        currentDate = prev.toISOString().split('T')[0];
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Get top topics
   */
  private getTopTopics(
    history: ReadingHistoryEntry[],
    allArticles: Article[]
  ): Array<{ topic: string; count: number }> {
    const topicCounts = new Map<string, number>();

    history.forEach((entry) => {
      const article = allArticles.find((a) => a.id === entry.articleId);
      if (article) {
        article.categories.forEach((topic) => {
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        });
      }
    });

    return Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get top feeds
   */
  private getTopFeeds(history: ReadingHistoryEntry[]): Array<{ feedId: string; count: number }> {
    const feedCounts = new Map<string, number>();

    history.forEach((entry) => {
      // Extract feed ID from article ID (assuming format: feedId_articleId)
      const feedId = entry.articleId.split('_')[0];
      feedCounts.set(feedId, (feedCounts.get(feedId) || 0) + 1);
    });

    return Array.from(feedCounts.entries())
      .map(([feedId, count]) => ({ feedId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get reading by hour (0-23)
   */
  private getReadingByHour(history: ReadingHistoryEntry[]): number[] {
    const counts = new Array(24).fill(0);

    history.forEach((entry) => {
      const hour = new Date(entry.timestamp).getHours();
      counts[hour]++;
    });

    return counts;
  }

  /**
   * Get reading by day of week (0=Sun, 6=Sat)
   */
  private getReadingByDayOfWeek(history: ReadingHistoryEntry[]): number[] {
    const counts = new Array(7).fill(0);

    history.forEach((entry) => {
      const day = new Date(entry.timestamp).getDay();
      counts[day]++;
    });

    return counts;
  }

  /**
   * Calculate reading trend
   */
  private calculateTrend(history: ReadingHistoryEntry[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 14) return 'stable';

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const thisWeek = history.filter((e) => e.timestamp >= weekAgo).length;
    const lastWeek = history.filter(
      (e) => e.timestamp >= twoWeeksAgo && e.timestamp < weekAgo
    ).length;

    const percentChange = lastWeek === 0 ? 100 : ((thisWeek - lastWeek) / lastWeek) * 100;

    if (percentChange > 10) return 'increasing';
    if (percentChange < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Get empty stats
   */
  private getEmptyStats(): ReadingStats {
    return {
      totalArticlesRead: 0,
      totalReadingTime: 0,
      averageReadingTime: 0,
      completionRate: 0,
      articlesThisWeek: 0,
      articlesThisMonth: 0,
      articlesThisYear: 0,
      currentStreak: 0,
      topTopics: [],
      topFeeds: [],
      readingByHour: new Array(24).fill(0),
      readingByDayOfWeek: new Array(7).fill(0),
      readingTrend: 'stable',
    };
  }
}

// Singleton instance
export const readingStatsTracker = new ReadingStatsTracker();

/**
 * React hook for reading statistics
 */
import { useState, useEffect } from 'react';

export function useReadingStats() {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await readingStatsTracker.getStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load reading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const data = await readingStatsTracker.getStats();
    setStats(data);
    setLoading(false);
  };

  return { stats, loading, refresh };
}

/**
 * React hook for daily reading stats
 */
export function useDailyReadingStats(days = 30) {
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const data = await readingStatsTracker.getDailyStats(startDate, endDate);
        setStats(data);
      } catch (error) {
        console.error('Failed to load daily stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [days]);

  return { stats, loading };
}

/**
 * Format reading time
 */
export function formatReadingTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format completion rate
 */
export function formatCompletionRate(rate: number): string {
  return `${Math.round(rate)}%`;
}
