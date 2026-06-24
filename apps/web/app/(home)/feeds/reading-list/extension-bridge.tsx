"use client";

import { useEffect } from "react";

import { handleExtensionMessage } from "@/lib/extension/message-handler";

export function ExtensionBridge() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handleExtensionMessage(event.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
