/**
 * Chart builder component - combines all steps into a unified interface.
 *
 * Implements T028: Real-time preview system
 */

"use client";

import { useState, useEffect } from "react";
import { DataSourceSelector, type DataSource } from "./DataSourceSelector";
import { ChartTypeSelector, type ChartType } from "./ChartTypeSelector";
import { DateRangeFilter, type DateRange, type DateRangePreset } from "./DateRangeFilter";
import { CustomizationPanel, type ChartCustomization } from "./CustomizationPanel";
import { ChartContainer } from "./ChartContainer";
import { LineChart, createLineChartData } from "./charts/LineChart";
import { BarChart, createBarChartData } from "./charts/BarChart";
import { ScatterChart, createScatterChartData } from "./charts/ScatterChart";
import { PieChart, createPieChartData } from "./charts/PieChart";
import { AreaChart, createAreaChartData } from "./charts/AreaChart";
import { HeatmapChart, createHeatmapData } from "./charts/HeatmapChart";

interface ChartBuilderProps {
  onSave?: (config: ChartConfiguration) => void;
}

export interface ChartConfiguration {
  dataSource: DataSource;
  chartType: ChartType;
  dateRange: DateRange;
  datePreset: DateRangePreset;
  customization: ChartCustomization;
  filters?: Record<string, any>;
}

export function ChartBuilder({ onSave }: ChartBuilderProps) {
  // State management
  const [step, setStep] = useState(1);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30d");
  const [customization, setCustomization] = useState<ChartCustomization>({
    showLegend: true,
    legendPosition: "top",
    gridLines: true,
    showTooltips: true,
    titleFontSize: 16,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<any>(null);

  // Auto-advance steps when selections are made
  useEffect(() => {
    if (step === 1 && dataSource) {
      setTimeout(() => setStep(2), 300);
    }
    if (step === 2 && chartType) {
      setTimeout(() => setStep(3), 300);
    }
    if (step === 3 && dateRange) {
      setTimeout(() => setStep(4), 300);
    }
  }, [dataSource, chartType, dateRange, step]);

  // Fetch chart data when configuration changes
  useEffect(() => {
    if (dataSource && chartType && dateRange) {
      fetchChartData();
    }
  }, [dataSource, chartType, dateRange]);

  const fetchChartData = async () => {
    setIsLoading(true);
    try {
      // Simulate API call with sample data
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Generate sample data based on chart type
      const sampleData = generateSampleData(chartType!, dataSource!);
      setChartData(sampleData);
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!dataSource || !chartType || !dateRange) {
      return;
    }

    const config: ChartConfiguration = {
      dataSource,
      chartType,
      dateRange,
      datePreset,
      customization,
    };

    onSave?.(config);
  };

  const canProceed = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return !!dataSource;
      case 2:
        return !!chartType;
      case 3:
        return !!dateRange;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Configuration panel */}
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  s === step
                    ? "bg-blue-600 text-white"
                    : canProceed(s)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {canProceed(s) && s < step ? "✓" : s}
              </div>
              {s < 4 && (
                <div
                  className={`h-1 w-8 ${canProceed(s) ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Data source */}
        <div
          className={`p-6 rounded-lg border transition-all ${
            step === 1
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
              : "border-gray-200 dark:border-gray-700"
          }`}
        >
          <DataSourceSelector
            selected={dataSource}
            onSelect={(source) => {
              setDataSource(source);
              if (step === 1) setStep(2);
            }}
            disabled={step !== 1 && step < 1}
          />
        </div>

        {/* Step 2: Chart type */}
        {step >= 2 && (
          <div
            className={`p-6 rounded-lg border transition-all ${
              step === 2
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <ChartTypeSelector
              selected={chartType}
              onSelect={(type) => {
                setChartType(type);
                if (step === 2) setStep(3);
              }}
              dataSource={dataSource ?? undefined}
              disabled={step !== 2 && step < 2}
            />
          </div>
        )}

        {/* Step 3: Date range */}
        {step >= 3 && (
          <div
            className={`p-6 rounded-lg border transition-all ${
              step === 3
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <DateRangeFilter
              selected={dateRange}
              onSelect={(range, preset) => {
                setDateRange(range);
                setDatePreset(preset);
                if (step === 3) setStep(4);
              }}
              disabled={step !== 3 && step < 3}
            />
          </div>
        )}

        {/* Step 4: Customization */}
        {step >= 4 && (
          <div className="p-6 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-900/10">
            <CustomizationPanel
              customization={customization}
              onChange={setCustomization}
              chartType={chartType ?? "line"}
            />
          </div>
        )}

        {/* Action buttons */}
        {step === 4 && (
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
            >
              Start Over
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Save Visualization
            </button>
          </div>
        )}
      </div>

      {/* Real-time preview panel */}
      <div className="lg:sticky lg:top-8 h-fit">
        <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Preview
          </h3>

          {!dataSource || !chartType || !dateRange ? (
            <div className="h-96 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-gray-600 dark:text-gray-400">
                  Configure your chart to see a preview
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Step {step} of 4
                </p>
              </div>
            </div>
          ) : (
            <ChartContainer
              isLoading={isLoading}
              error={null}
              isEmpty={!chartData}
              onRetry={fetchChartData}
            >
              {renderChart(chartType, chartData, customization)}
            </ChartContainer>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Render chart based on type.
 */
function renderChart(
  type: ChartType,
  data: any,
  customization: ChartCustomization
): JSX.Element | null {
  if (!data) return null;

  const commonOptions = {
    plugins: {
      title: {
        display: !!customization.title,
        text: customization.title,
        font: {
          size: customization.titleFontSize,
        },
      },
      legend: {
        display: customization.showLegend,
        position: customization.legendPosition,
      },
      tooltip: {
        enabled: customization.showTooltips,
      },
    },
    scales: {
      x: {
        title: {
          display: !!customization.xAxisLabel,
          text: customization.xAxisLabel,
        },
        grid: {
          display: customization.gridLines,
        },
      },
      y: {
        title: {
          display: !!customization.yAxisLabel,
          text: customization.yAxisLabel,
        },
        grid: {
          display: customization.gridLines,
        },
      },
    },
  };

  switch (type) {
    case "line":
      return <LineChart data={data} options={commonOptions as any} height={400} />;
    case "bar":
      return <BarChart data={data} options={commonOptions as any} height={400} />;
    case "scatter":
      return <ScatterChart data={data} options={commonOptions as any} height={400} />;
    case "pie":
      return <PieChart data={data} height={400} />;
    case "area":
      return <AreaChart data={data} options={commonOptions as any} height={400} stacked={customization.stacked} />;
    case "heatmap":
      return <HeatmapChart {...data} height={400} />;
    default:
      return null;
  }
}

/**
 * Generate sample data for preview.
 */
function generateSampleData(chartType: ChartType, dataSource: DataSource): any {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = Array.from({ length: 7 }, () => Math.floor(Math.random() * 100) + 20);

  switch (chartType) {
    case "line":
      return createLineChartData(labels, [{ label: dataSource, data: values }]);
    case "bar":
      return createBarChartData(labels, [{ label: dataSource, data: values }]);
    case "scatter":
      return createScatterChartData([
        {
          label: dataSource,
          data: Array.from({ length: 20 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
          })),
        },
      ]);
    case "pie":
      return createPieChartData(labels.slice(0, 5), values.slice(0, 5));
    case "area":
      return createAreaChartData(labels, [{ label: dataSource, data: values }]);
    case "heatmap":
      return {
        data: createHeatmapData(
          labels,
          ["Week 1", "Week 2", "Week 3"],
          Array.from({ length: 3 }, () => Array.from({ length: 7 }, () => Math.random() * 100))
        ),
        xLabels: labels,
        yLabels: ["Week 1", "Week 2", "Week 3"],
      };
    default:
      return null;
  }
}
