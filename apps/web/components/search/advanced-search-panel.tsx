/**
 * Advanced Search Panel
 * 
 * Provides filtering UI for search results including:
 * - Topic filters
 * - Feed filters
 * - Date range
 * - Starred filter
 * - Sort options
 * 
 * @see specs/004-client-side-features/tasks.md#t022
 */

'use client';

import React, { useState } from 'react';

export interface SearchFilters {
  topics?:    string[];
  feedIds?:   string[];
  dateFrom?:  string;
  dateTo?:    string;
  starred?:   boolean;
  sortBy:     'relevance' | 'date' | 'readTime';
}

interface AdvancedSearchPanelProps {
  filters:   SearchFilters;
  onChange:  (filters: SearchFilters) => void;
  onClear:   () => void;
  isOpen:    boolean;
  onToggle:  () => void;
}

export function AdvancedSearchPanel({
  filters,
  onChange,
  onClear,
  isOpen,
  onToggle,
}: AdvancedSearchPanelProps): JSX.Element {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(filters.topics || []);

  const availableTopics = [
    'AI',
    'Machine Learning',
    'Deep Learning',
    'Natural Language Processing',
    'Computer Vision',
    'Robotics',
    'Data Science',
    'Neural Networks',
  ];

  const handleTopicToggle = (topic: string) => {
    const updated = selectedTopics.includes(topic)
      ? selectedTopics.filter((t) => t !== topic)
      : [...selectedTopics, topic];

    setSelectedTopics(updated);
    onChange({ ...filters, topics: updated });
  };

  const handleDateFromChange = (date: string) => {
    onChange({ ...filters, dateFrom: date });
  };

  const handleDateToChange = (date: string) => {
    onChange({ ...filters, dateTo: date });
  };

  const handleStarredToggle = () => {
    onChange({ ...filters, starred: !filters.starred });
  };

  const handleSortChange = (sortBy: SearchFilters['sortBy']) => {
    onChange({ ...filters, sortBy });
  };

  return (
    <div>
      {/* Filter Toggle Button */}
      <button
        onClick={onToggle}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        data-testid="filter-toggle"
      >
        <span>🔍</span>
        <span>{isOpen ? 'Hide' : 'Show'} Filters</span>
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div
          className="rounded-lg border border-gray-200 bg-white p-4 mb-4"
          data-testid="search-filters"
        >
          {/* Topics */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Topics</h3>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleTopicToggle(topic)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedTopics.includes(topic)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  data-testid={`filter-topic-${topic.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Date Range</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">From</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                  data-testid="filter-date-from"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">To</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                  data-testid="filter-date-to"
                />
              </div>
            </div>
          </div>

          {/* Starred Filter */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.starred || false}
                onChange={handleStarredToggle}
                className="rounded"
                data-testid="filter-starred"
              />
              <span className="text-sm text-gray-700">Starred articles only</span>
            </label>
          </div>

          {/* Sort Options */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Sort By</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleSortChange('relevance')}
                className={`px-3 py-1 rounded text-sm ${
                  filters.sortBy === 'relevance'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid="sort-relevance"
              >
                Relevance
              </button>
              <button
                onClick={() => handleSortChange('date')}
                className={`px-3 py-1 rounded text-sm ${
                  filters.sortBy === 'date'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid="sort-date"
              >
                Date
              </button>
              <button
                onClick={() => handleSortChange('readTime')}
                className={`px-3 py-1 rounded text-sm ${
                  filters.sortBy === 'readTime'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid="sort-read-time"
              >
                Read Time
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClear}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
              data-testid="clear-filters"
            >
              Clear Filters
            </button>
            <button
              onClick={onToggle}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              data-testid="apply-filters"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
