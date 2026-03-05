/**
 * Analytics layout with navigation.
 */

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/analytics", label: "Overview", icon: "🏠" },
  { href: "/analytics/visualizations", label: "Visualizations (Advanced)", icon: "📊" },
  { href: "/analytics/3d-topics", label: "3D Topics (Advanced)", icon: "🌐" },
  { href: "/analytics/dashboards", label: "Dashboards (Advanced)", icon: "📋" },
  { href: "/analytics/forecasts", label: "Forecasts (Advanced)", icon: "📈" },
  { href: "/analytics/comparison", label: "Comparison (Advanced)", icon: "⚖️" },
  { href: "/analytics/export", label: "Export (Advanced)", icon: "💾" },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Analytics
              </span>
            </div>

            <div className="flex gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/analytics"
                    ? pathname === "/analytics" || pathname === "/analytics/"
                    : pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg transition font-medium text-sm flex items-center gap-2 ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="hidden md:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main>{children}</main>
    </div>
  );
}
