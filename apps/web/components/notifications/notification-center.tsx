/**
 * NotificationCenter - Notification list panel
 * 
 * Displays all notifications with real-time updates.
 * Supports mark as read, dismiss, and filtering.
 */

"use client";

import { useState, useEffect } from "react";
import { useWebSocket } from "@/lib/use-websocket";
import type { WebSocketNotification } from "@/lib/websocket";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function NotificationCenter({ isOpen, onClose, className = "" }: NotificationCenterProps) {
  const { notifications, markRead, dismiss, isConnected } = useWebSocket();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-4 top-16 w-96 max-h-[600px] bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Notifications
          </h2>
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            {!isConnected && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                Reconnecting...
              </span>
            )}
            {/* Filter Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded p-1">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filter === "all"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filter === "unread"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                Unread
              </button>
            </div>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => markRead(notification.id)}
                  onDismiss={() => dismiss(notification.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

interface NotificationItemProps {
  notification: WebSocketNotification;
  onMarkRead: () => void;
  onDismiss: () => void;
}

function NotificationItem({ notification, onMarkRead, onDismiss }: NotificationItemProps) {
  const isUnread = !notification.read_at;
  const timeAgo = getTimeAgo(new Date(notification.created_at));

  const typeColors = {
    new_article: "text-blue-600 dark:text-blue-400",
    trending_topic: "text-purple-600 dark:text-purple-400",
    feed_updated: "text-green-600 dark:text-green-400",
    system_alert: "text-red-600 dark:text-red-400",
  };

  const typeIcons = {
    new_article: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    trending_topic: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    feed_updated: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    system_alert: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  return (
    <li
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
        isUnread ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
      }`}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${typeColors[notification.type]}`}>
          {typeIcons[notification.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
              {notification.title}
            </h3>
            {isUnread && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1" />
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {timeAgo}
            </span>
            <div className="flex gap-2">
              {isUnread && (
                <button
                  onClick={onMarkRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Mark read
                </button>
              )}
              <button
                onClick={onDismiss}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Dismiss
              </button>
              {notification.action_url && (
                <a
                  href={notification.action_url}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

