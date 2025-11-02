/**
 * Chart container component with error boundaries and loading states.
 *
 * Base component for all visualization types providing:
 * - Error boundary for graceful failure handling
 * - Loading skeleton
 * - Responsive container sizing
 */

"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ChartContainerProps {
  title?: string;
  description?: string;
  children: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  minHeight?: string;
  onRetry?: () => void;
}

interface ChartContainerState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for chart rendering.
 */
class ChartErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error) => void },
  ChartContainerState
> {
  constructor(props: { children: ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ChartContainerState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Chart rendering error:", error, errorInfo);
    this.props.onError?.(error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <div className="mb-2 text-red-600 font-semibold">
            Chart Rendering Error
          </div>
          <div className="text-red-500 text-sm mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Loading skeleton for charts.
 */
function ChartLoadingSkeleton({
  minHeight = "300px",
}: {
  minHeight?: string;
}) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 p-6 animate-pulse"
      style={{ minHeight }}
    >
      <div className="space-y-4">
        {/* Title skeleton */}
        <div className="h-6 bg-gray-300 rounded w-1/3" />

        {/* Chart area skeleton */}
        <div className="h-64 bg-gray-200 rounded" />

        {/* Legend skeleton */}
        <div className="flex gap-4 justify-center">
          <div className="h-4 bg-gray-300 rounded w-20" />
          <div className="h-4 bg-gray-300 rounded w-20" />
          <div className="h-4 bg-gray-300 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Error display component.
 */
function ChartError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mb-2 text-amber-700 font-semibold">
        Unable to Load Chart
      </div>
      <div className="text-amber-600 text-sm mb-4">{error.message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Main chart container component.
 */
export function ChartContainer({
  title,
  description,
  children,
  isLoading = false,
  error = null,
  minHeight = "300px",
  onRetry,
}: ChartContainerProps): JSX.Element {
  if (error) {
    return <ChartError error={error} onRetry={onRetry} />;
  }

  if (isLoading) {
    return <ChartLoadingSkeleton minHeight={minHeight} />;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
      )}

      {/* Chart content with error boundary */}
      <ChartErrorBoundary>
        <div style={{ minHeight }}>{children}</div>
      </ChartErrorBoundary>
    </div>
  );
}

/**
 * Empty state component for charts with no data.
 */
export function ChartEmptyState({
  message = "No data available",
  suggestion,
}: {
  message?: string;
  suggestion?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
      <div className="text-gray-600 font-medium mb-2">{message}</div>
      {suggestion && <div className="text-gray-500 text-sm">{suggestion}</div>}
    </div>
  );
}
