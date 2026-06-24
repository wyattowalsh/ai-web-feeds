import type { Metadata } from "next";

import { ConflictResolutionPanel } from "@/components/offline/conflict-resolution-panel";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Offline Conflicts - AI Web Feeds",
  description: "Review and reconcile offline read/star changes after reconnecting.",
  path: "/offline/conflicts",
});

export default function OfflineConflictsPage() {
  return (
    <div className="page-wrap page-stack py-8">
      <ConflictResolutionPanel />
    </div>
  );
}
