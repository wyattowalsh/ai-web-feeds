import type { LiveStreamProgress } from "./types";
import type { ReaderShellStat } from "@/components/reader/reader-shell-header";

import {
  buildLiveStatusText,
  buildReaderShellStats,
  type BuildLiveStatusTextParams,
  type BuildReaderShellStatsParams,
} from "./build-reader-shell-stats";
import {
  buildReaderWorkspaceChrome,
  type BuildReaderWorkspaceChromeParams,
  type ReaderWorkspaceChrome,
} from "./build-reader-workspace-chrome";

export type BuildReaderShellPresentationParams = BuildReaderShellStatsParams &
  BuildReaderWorkspaceChromeParams & {
    liveProgress: LiveStreamProgress | null;
  };

export type ReaderShellPresentation = {
  chrome: ReaderWorkspaceChrome;
  readerStats: ReaderShellStat[];
  liveStatusText: string | null;
};

export function buildReaderShellPresentation(
  params: BuildReaderShellPresentationParams,
): ReaderShellPresentation {
  const { liveProgress, visibleCount, ...rest } = params;
  const chrome = buildReaderWorkspaceChrome(rest);
  const readerStats = buildReaderShellStats({ ...rest, visibleCount });
  const liveStatusText = buildLiveStatusText({
    liveProgress,
    visibleCount,
  } satisfies BuildLiveStatusTextParams);

  return { chrome, readerStats, liveStatusText };
}
