"use client";

import * as React from "react";
import { Copy, Share2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { shareUrl, type SharePayload, type ShareResult } from "@/lib/utility/share";

export type ShareButtonProps = {
  payload: SharePayload;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  showLabel?: boolean;
  onResult?: (result: ShareResult) => void;
  label?: string;
  copiedLabel?: string;
};

export function ShareButton({
  payload,
  className,
  variant = "outline",
  size = "sm",
  showLabel = false,
  onResult,
  label = "Share",
  copiedLabel = "Copied",
}: ShareButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await shareUrl(payload);
      onResult?.(result);

      if (result.method === "clipboard" && result.success) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
    } finally {
      setBusy(false);
    }
  };

  const Icon = copied ? Copy : Share2;
  const buttonLabel = copied ? copiedLabel : label;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={() => void handleShare()}
      disabled={busy}
      aria-label={showLabel ? undefined : buttonLabel}
    >
      <Icon className="size-4" aria-hidden />
      {showLabel ? <span>{buttonLabel}</span> : null}
    </Button>
  );
}

export default ShareButton;
