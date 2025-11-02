/**
 * Custom Dashboard Builder with React Grid Layout.
 *
 * Implements Phase 5 (US3): T046-T057
 * - Drag-and-drop dashboard builder
 * - Widget management (add, remove, resize, configure)
 * - Dashboard CRUD operations
 * - Grid layout persistence
 */

"use client";

import { useState, useCallback } from "react";
import { Responsive, WidthProvider, Layout, Layouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface DashboardWidget {
  id: string;
  visualization_id: number;
  type: "chart" | "metric" | "table" | "text";
  title: string;
  layout: Layout;
  config: Record<string, any>;
}

interface DashboardBuilderProps {
  dashboardId?: number;
  initialWidgets?: DashboardWidget[];
  onSave?: (widgets: DashboardWidget[], layouts: Layouts) => void;
  editable?: boolean;
}

export function DashboardBuilder({
  dashboardId,
  initialWidgets = [],
  onSave,
  editable = true,
}: DashboardBuilderProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(initialWidgets);
  const [layouts, setLayouts] = useState<Layouts>({
    lg: initialWidgets.map((w) => w.layout),
  });
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [showAddWidget, setShowAddWidget] = useState(false);

  // Grid configuration
  const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
  const rowHeight = 60;

  const handleLayoutChange = useCallback((layout: Layout[], allLayouts: Layouts) => {
    setLayouts(allLayouts);

    // Update widget layouts
    setWidgets((prev) =>
      prev.map((widget) => {
        const newLayout = layout.find((l) => l.i === widget.id);
        if (newLayout) {
          return { ...widget, layout: newLayout };
        }
        return widget;
      })
    );
  }, []);

  const addWidget = (type: DashboardWidget["type"], visualizationId?: number) => {
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      visualization_id: visualizationId ?? 0,
      type,
      title: `New ${type}`,
      layout: {
        i: `widget-${Date.now()}`,
        x: 0,
        y: Infinity, // Put at bottom
        w: type === "metric" ? 3 : 6,
        h: type === "metric" ? 2 : 4,
      },
      config: {},
    };

    setWidgets((prev) => [...prev, newWidget]);
    setShowAddWidget(false);
  };

  const removeWidget = (widgetId: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    if (selectedWidget === widgetId) {
      setSelectedWidget(null);
    }
  };

  const updateWidget = (widgetId: string, updates: Partial<DashboardWidget>) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, ...updates } : w))
    );
  };

  const handleSave = () => {
    onSave?.(widgets, layouts);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Dashboard Builder
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {widgets.length} widget{widgets.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddWidget(true)}
              disabled={widgets.length >= 20}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Widget
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Save Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
        {widgets.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Widgets Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Add your first widget to get started
              </p>
              {editable && (
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  + Add Widget
                </button>
              )}
            </div>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={cols}
            rowHeight={rowHeight}
            onLayoutChange={handleLayoutChange}
            isDraggable={editable}
            isResizable={editable}
            compactType="vertical"
            preventCollision={false}
          >
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 ${
                  selectedWidget === widget.id
                    ? "border-blue-500"
                    : "border-transparent"
                }`}
                onClick={() => setSelectedWidget(widget.id)}
              >
                <WidgetCard
                  widget={widget}
                  onRemove={editable ? () => removeWidget(widget.id) : undefined}
                  onUpdate={editable ? (updates) => updateWidget(widget.id, updates) : undefined}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <AddWidgetModal
          onAdd={addWidget}
          onClose={() => setShowAddWidget(false)}
          maxWidgets={20}
          currentCount={widgets.length}
        />
      )}

      {/* Widget Configuration Panel */}
      {selectedWidget && editable && (
        <WidgetConfigPanel
          widget={widgets.find((w) => w.id === selectedWidget)!}
          onUpdate={(updates) => updateWidget(selectedWidget, updates)}
          onClose={() => setSelectedWidget(null)}
        />
      )}
    </div>
  );
}

/**
 * Individual widget card.
 */
function WidgetCard({
  widget,
  onRemove,
  onUpdate,
}: {
  widget: DashboardWidget;
  onRemove?: () => void;
  onUpdate?: (updates: Partial<DashboardWidget>) => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Widget header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
          {widget.title}
        </h3>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-gray-400 hover:text-red-500 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Widget content */}
      <div className="flex-1 p-4 overflow-auto">
        {widget.type === "chart" && (
          <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded">
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Chart Widget</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Visualization #{widget.visualization_id}
              </p>
            </div>
          </div>
        )}

        {widget.type === "metric" && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              1,234
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Sample Metric</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">+12.5%</p>
          </div>
        )}

        {widget.type === "table" && (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2">Sample 1</td>
                  <td className="p-2 text-right">100</td>
                </tr>
                <tr>
                  <td className="p-2">Sample 2</td>
                  <td className="p-2 text-right">200</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {widget.type === "text" && (
          <div className="h-full prose dark:prose-invert">
            <p className="text-gray-600 dark:text-gray-400">
              This is a text widget. Add your content here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Add widget modal.
 */
function AddWidgetModal({
  onAdd,
  onClose,
  maxWidgets,
  currentCount,
}: {
  onAdd: (type: DashboardWidget["type"], visualizationId?: number) => void;
  onClose: () => void;
  maxWidgets: number;
  currentCount: number;
}) {
  const widgetTypes: Array<{ type: DashboardWidget["type"]; label: string; icon: string }> = [
    { type: "chart", label: "Chart", icon: "📊" },
    { type: "metric", label: "Metric", icon: "📈" },
    { type: "table", label: "Table", icon: "📋" },
    { type: "text", label: "Text", icon: "📝" },
  ];

  const canAdd = currentCount < maxWidgets;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Add Widget
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {!canAdd ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-amber-800 dark:text-amber-200">
              Maximum widget limit reached ({maxWidgets} widgets). Remove a widget to add a
              new one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {widgetTypes.map((wt) => (
              <button
                key={wt.type}
                onClick={() => onAdd(wt.type)}
                className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition text-center"
              >
                <div className="text-4xl mb-3">{wt.icon}</div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {wt.label}
                </h4>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Widget configuration panel.
 */
function WidgetConfigPanel({
  widget,
  onUpdate,
  onClose,
}: {
  widget: DashboardWidget;
  onUpdate: (updates: Partial<DashboardWidget>) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Widget Settings
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Title
          </label>
          <input
            type="text"
            value={widget.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type
          </label>
          <p className="text-gray-600 dark:text-gray-400 capitalize">{widget.type}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Size
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {widget.layout.w} × {widget.layout.h} grid units
          </p>
        </div>

        {widget.type === "chart" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Visualization ID
            </label>
            <input
              type="number"
              value={widget.visualization_id}
              onChange={(e) =>
                onUpdate({ visualization_id: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        )}
      </div>
    </div>
  );
}
