"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type ToastContextValue = {
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  const toast = React.useCallback((props: Omit<Toast, "id">): string => {
    const id = generateId();
    const duration = props.duration ?? DEFAULT_DURATION;

    const newToast: Toast = {
      id,
      ...props,
    };

    setToasts((current) => [...current, newToast]);

    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast,
      dismiss,
      dismissAll,
    }),
    [toasts, toast, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-[var(--reader-z-toast,60)] flex w-full max-w-[380px] flex-col gap-2 px-4 sm:px-0"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? "default";

  const variantClasses: Record<ToastVariant, string> = {
    default: "border-border bg-card text-foreground",
    success:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:border-emerald-400/30",
    error: "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40",
    warning:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 dark:border-amber-400/30",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 dark:border-sky-400/30",
  };

  return (
    <div
      role="status"
      className={cn(
        "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[swipe=end]:slide-out-to-right-full",
        variantClasses[variant],
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {toast.title ? (
          <div className="text-sm font-semibold leading-none tracking-tight">{toast.title}</div>
        ) : null}
        {toast.description ? <div className="text-sm opacity-90">{toast.description}</div> : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 inline-flex items-center rounded-md border border-current/40 px-2 py-1 text-xs font-medium transition hover:bg-current/10"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="ml-2 inline-flex size-6 items-center justify-center rounded-md opacity-60 transition hover:bg-foreground/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    // Provide a safe no-op fallback when used outside provider
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      toast: (_props?: Omit<Toast, "id">) => "",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      dismiss: (_id?: string) => {},
      dismissAll: () => {},
      toasts: [] as Toast[],
    };
  }

  return context;
}

export { ToastContext };
