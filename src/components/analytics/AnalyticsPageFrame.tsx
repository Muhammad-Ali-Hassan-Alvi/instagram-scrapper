import { Suspense } from "react";

import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { DbRefreshNotice } from "@/components/analytics/DbRefreshNotice";
import type { AnalyticsSnapshot } from "@/types/analytics";

export function AnalyticsPageFrame({
  title,
  snapshot,
  children,
}: {
  title: string;
  snapshot: AnalyticsSnapshot;
  children: React.ReactNode;
}) {
  return (
    <AnalyticsShell title={title}>
      <Suspense fallback={<p className="mb-4 text-xs text-slate-500">Loading filters…</p>}>
        <div className="mb-4">
          <AnalyticsFilters snapshot={snapshot} />
        </div>
      </Suspense>

      <DbRefreshNotice snapshot={snapshot} />

      {snapshot.error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {snapshot.error}
        </div>
      )}

      {children}
    </AnalyticsShell>
  );
}
